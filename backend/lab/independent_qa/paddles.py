"""Forward physical identity and actual retained QA precede a typed stock recovery."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils.timezone import is_naive

from core.time import server_now
from inventory.allocations.models import ReturnAcceptance, SupplyStockEffect, SupplyUse
from inventory.allocations.scope import assignment_contexts, location_context, require_contexts
from inventory.models import Location, Piece, StockMovement
from inventory.paddle_returns import append_paddle_return
from inventory.transactions import inventory_transaction
from inventory.transfers.custody import balance
from lab.access import LabTarget, PreparedLabSubject, prepare_lab_subject
from lab.commands import LabCommandInput, LabOutcome, execute_prepared_command
from lab.dependencies import require_physical_material
from lab.exceptions import LabConflictError, LabInProgressError
from lab.independent_qa.evidence import bind_paddle_evidence, verified_paddle_evidence
from lab.independent_qa.services import current_policy
from lab.methods import configured_method
from lab.models import (
    DailyRecountSample,
    DailyRecountSampleMember,
    EggCountAttempt,
    EggPaddle,
    LabCommand,
    LabResultRevision,
    PaddleBagBinding,
    PaddleReuse,
    RecountRequest,
)
from lab.permissions import PADDLE_REUSE
from lab.recounts import daily_population, population_fingerprint
from lab.transactions import LabParticipants, lab_transaction, require_lab_lock
from ovitraps.models import OvitrapReading
from rules.selectors import list_parameters_with_current
from uploads.access import UploadActor
from uploads.limits import FIELD_UPLOAD


@dataclass(frozen=True)
class PreparedPaddle:
    subjects: tuple[PreparedLabSubject, ...]
    users: tuple[UUID, ...]
    sources: tuple[tuple[UUID, UUID], ...]
    contexts: tuple[dict[str, Any], ...]
    principal_source_id: UUID | None


def movement(actor: UploadActor, identifier: UUID) -> StockMovement:
    return cast(
        StockMovement,
        get_object_or_404(
            StockMovement.objects.filter(organization=actor.organization).select_related(
                "piece__admission",
                "lot",
                "unit_version",
                "location",
                "assignment__origin",
                "operation__supply_source__event",
                "operation__transfer_event",
            ),
            pk=identifier,
        ),
    )


def paddle(actor: UploadActor, identifier: UUID) -> EggPaddle:
    return cast(
        EggPaddle,
        get_object_or_404(
            EggPaddle.objects.filter(organization=actor.organization).select_related(
                "piece__lot",
                "location",
                "source_movement",
            ),
            pk=identifier,
        ),
    )


def bag_context(binding: PaddleBagBinding) -> dict[str, str]:
    quadrant = binding.bag.reading.ovitrap.sampling_point.block.quadrant
    return {"center_id": str(quadrant.center_id), "quadrant_id": str(quadrant.pk)}


def movement_contexts(source: StockMovement) -> list[dict[str, Any]]:
    contexts = [
        {
            "center_id": str(source.lot.center_id),
            "quadrant_id": None if source.lot.quadrant_id is None else str(source.lot.quadrant_id),
        }
    ]
    if source.location is not None:
        contexts.append(location_context(source.location))
    elif source.assignment is not None:
        contexts.extend(assignment_contexts(source.assignment))
    else:
        raise Http404
    return contexts


def fact_contexts(fact: EggPaddle | PaddleBagBinding | PaddleReuse) -> list[dict[str, Any]]:
    registered = (
        fact
        if isinstance(fact, EggPaddle)
        else fact.paddle
        if isinstance(fact, PaddleBagBinding)
        else fact.binding.paddle
    )
    contexts = [
        location_context(registered.location),
        *movement_contexts(registered.source_movement),
    ]
    if isinstance(fact, PaddleBagBinding):
        contexts.extend([bag_context(fact), *movement_contexts(fact.issue_movement)])
    if isinstance(fact, PaddleReuse):
        contexts.extend(
            [
                bag_context(fact.binding),
                *movement_contexts(fact.binding.issue_movement),
                *movement_contexts(fact.source_movement),
                location_context(fact.destination),
            ]
        )
    return contexts


def movement_sources(source: StockMovement) -> set[UUID]:
    """Resolve persisted delivery/return authors before acquiring any identity lock."""
    identities = set()
    ledger = source.operation.supply_source
    if ledger is not None:
        if ledger.event is not None:
            identities.add(ledger.event.declared_source_uuid)
        if ledger.execution_id is not None:
            acceptance = (
                ReturnAcceptance.objects.filter(execution_id=ledger.execution_id)
                .select_related("declaration__event")
                .first()
            )
            if acceptance is not None:
                identities.add(acceptance.declaration.event.declared_source_uuid)
    transfer = source.operation.transfer_event
    if transfer is not None and transfer.declared_source_uuid is not None:
        identities.add(transfer.declared_source_uuid)
    return identities


def prepare_paddle_command(
    actor: UploadActor, request: LabCommandInput, replay: bool = False
) -> PreparedPaddle:
    source = movement(
        actor,
        request.values["source_movement_id"]
        if request.action != "paddle_bind"
        else request.values["issue_movement_id"],
    )
    contexts = movement_contexts(source)
    piece = source.piece
    if piece is None:
        raise Http404
    users = {actor.user.pk, human_id(source.created_by_id), human_id(piece.created_by_id)}
    source_ids = movement_sources(source)
    subjects = []
    principal_source_id = None
    if request.action != "paddle_register":
        registered = paddle(actor, request.target.identifier)
        contexts.extend(fact_contexts(registered))
        users.add(human_id(registered.created_by_id))
        bags = set() if replay else {row.bag_id for row in registered.bindings.all()}
        if not replay:
            users.update(
                human_id(identifier)
                for identifier in registered.bindings.values_list("created_by_id", flat=True)
            )
            users.update(
                human_id(identifier)
                for identifier in PaddleReuse.objects.filter(
                    binding__paddle=registered
                ).values_list("created_by_id", flat=True)
            )
        if request.action == "paddle_bind":
            bags.add(UUID(str(request.values["bag_id"])))
        else:
            binding = get_object_or_404(registered.bindings.all(), pk=request.values["binding_id"])
            bags.add(binding.bag_id)
            contexts.extend(fact_contexts(binding))
        principal_bag_id = (
            UUID(str(request.values["bag_id"]))
            if request.action == "paddle_bind"
            else binding.bag_id
        )
        for identifier in sorted(bags):
            subject = prepare_lab_subject(actor, LabTarget("bag", identifier), PADDLE_REUSE)
            subjects.append(subject)
            if identifier == principal_bag_id:
                principal_source_id = subject.source_id
            contexts.append(
                {"center_id": str(subject.center_id), "quadrant_id": str(subject.quadrant_id)}
            )
            from ovitraps.models import Bag

            source_ids.add(
                Bag.objects.get(
                    organization=actor.organization, pk=identifier
                ).reading.ovitrap.event_id
            )
    if request.action == "paddle_reuse":
        destination = get_object_or_404(
            Location.objects.filter(organization=actor.organization),
            pk=request.values["destination_location_id"],
        )
        contexts.append(location_context(destination))
        require_contexts(actor, "inventory.reconcile", contexts)
    require_contexts(actor, PADDLE_REUSE, contexts)
    require_contexts(actor, FIELD_UPLOAD, contexts)
    from field_sync.models import FieldEvent

    sources = tuple(
        FieldEvent.objects.filter(organization=actor.organization, pk__in=source_ids)
        .order_by("pk")
        .values_list("pk", "created_by_id")
    )
    if len(sources) != len(source_ids) or any(user is None for _, user in sources) or None in users:
        raise Http404
    unique_contexts = {
        (context["center_id"], context["quadrant_id"]): context for context in contexts
    }
    captured_contexts = tuple(
        unique_contexts[key]
        for key in sorted(unique_contexts, key=lambda key: (str(key[0]), str(key[1])))
    )
    return PreparedPaddle(
        tuple(subjects),
        tuple(sorted(users)),
        tuple((identifier, human_id(user)) for identifier, user in sources),
        captured_contexts,
        principal_source_id,
    )


def human_id(identifier: UUID | None) -> UUID:
    if identifier is None:
        raise Http404
    return identifier


def execute_paddle_command(actor: UploadActor, request: LabCommandInput) -> LabOutcome:
    replay = LabCommand.objects.filter(
        organization=actor.organization,
        created_by=actor.user,
        command_id=request.command_id,
        action=request.action,
        target_id=request.target.identifier,
        result__isnull=False,
    ).exists()
    prepared = prepare_paddle_command(actor, request, replay)
    with lab_transaction(
        actor, prepared.subjects, LabParticipants(prepared.users, prepared.sources)
    ):
        if prepare_paddle_command(actor, request, replay) != prepared:
            raise LabInProgressError
        with inventory_transaction(organization=actor.organization):
            return execute_prepared_command(actor, request, prepared.principal_source_id)


def paddle_subjects(actor: UploadActor, request: LabCommandInput) -> list[dict[str, Any]]:
    contexts = list(prepare_paddle_command(actor, request).contexts)
    codes = (
        (PADDLE_REUSE, FIELD_UPLOAD, "inventory.reconcile")
        if request.action == "paddle_reuse"
        else (PADDLE_REUSE, FIELD_UPLOAD)
    )
    return [{"permission": permission, "contexts": contexts} for permission in codes]


def register_paddle(
    actor: UploadActor, command: LabCommand, request: LabCommandInput
) -> LabOutcome:
    source = movement(actor, request.values["source_movement_id"])
    piece = get_object_or_404(
        Piece.objects.filter(organization=actor.organization), pk=request.target.identifier
    )
    location = get_object_or_404(
        Location.objects.filter(organization=actor.organization), pk=request.values["location_id"]
    )
    if (
        source.piece_id != piece.pk
        or source.location_id != location.pk
        or source.quantity != 1
        or source.unit_version.identity_kind != "piece"
        or balance(source, location) != 1
    ):
        raise LabConflictError("lab_paddle_identity_unproven")
    if (
        EggPaddle.objects.filter(organization=actor.organization, piece=piece).exists()
        or EggPaddle.objects.filter(
            organization=actor.organization, code=request.values["code"]
        ).exists()
    ):
        raise LabConflictError("lab_paddle_identity_exists")
    evidence = verified_paddle_evidence(
        actor, request.values["evidence_ids"], list(prepare_paddle_command(actor, request).contexts)
    )
    registered = EggPaddle.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        command=command,
        code=request.values["code"],
        piece=piece,
        source_movement=source,
        location=location,
        evidence_ids=command.canonical_input["evidence_ids"],
        source_proof={
            "piece_id": str(piece.pk),
            "source_movement_id": str(source.pk),
            "location_id": str(location.pk),
            "observation": "forward_physical_identity",
        },
    )
    bind_paddle_evidence(command, evidence)
    return LabOutcome(201, {"paddle": paddle_projection(registered)})


def issue_effect(
    binding: PaddleBagBinding | None, source: StockMovement, reading: OvitrapReading
) -> SupplyStockEffect:
    effect = (
        SupplyStockEffect.objects.filter(movement=source, organization=source.organization)
        .select_related("source__event__assignment", "receipt_line__receipt__event")
        .first()
    )
    if (
        effect is None
        or effect.receipt_line_id is None
        or source.piece_id is None
        or abs(source.quantity) != 1
    ):
        raise LabConflictError("lab_paddle_issue_unproven")
    if effect.source.event_id is None or hasattr(effect.source.event, "void_audit"):
        raise LabConflictError("lab_paddle_issue_unproven")
    from reviews.effect_receipts import is_effective

    if not is_effective(reading.event) or not is_effective(reading.ovitrap.event):
        raise LabConflictError("lab_paddle_issue_unproven")
    if effect.kind == "used" and source.quantity == -1:
        valid = SupplyUse.objects.filter(
            event=effect.source.event,
            receipt_line=effect.receipt_line,
            quantity=1,
            work_kind="field_event",
            work_source__in=(reading.event, reading.ovitrap.event),
        ).exists()
    else:
        valid = (
            effect.kind == "courier_credit"
            and source.quantity == 1
            and effect.source.event.assignment.courier_id == reading.ovitrap.event.created_by_id
            and str(effect.receipt_line_id) in reading.ovitrap.placement.supply_refs
        )
    if not valid or (binding is not None and binding.issue_movement.piece_id != source.piece_id):
        raise LabConflictError("lab_paddle_issue_unproven")
    return cast(SupplyStockEffect, effect)


def bind_paddle(actor: UploadActor, command: LabCommand, request: LabCommandInput) -> LabOutcome:
    registered = paddle(actor, request.target.identifier)
    previous = registered.bindings.first()
    revision = 0 if previous is None else previous.cycle
    if request.values["expected_revision"] != revision:
        raise LabConflictError("lab_state_conflict", revision)
    from lab.access import scoped_bags

    bag = get_object_or_404(scoped_bags(actor, PADDLE_REUSE), pk=request.values["bag_id"])
    require_physical_material(bag)
    source = movement(actor, request.values["issue_movement_id"])
    if (
        source.piece_id != registered.piece_id
        or registered.created_at >= source.created_at
        or registered.created_at >= bag.reading.event.server_received_at
    ):
        raise LabConflictError("lab_paddle_forward_identity_required")
    effect = issue_effect(None, source, bag.reading)
    if previous is not None:
        prior = getattr(previous, "reuse", None)
        if (
            prior is None
            or prior.dried_at > source.created_at
            or bag.reading.event.device_time <= prior.dried_at
            or bag.reading.event.server_received_at <= prior.dried_at
        ):
            raise LabConflictError("lab_paddle_cycle_open")
        prior_frame = reuse_frame(previous, actor)
        if (
            prior.first_result_id != UUID(prior_frame["result_revision_id"])
            or prior.frame_proof["qa"] != prior_frame
        ):
            raise LabConflictError("lab_material_dependency")
    if PaddleBagBinding.objects.filter(bag=bag).exists():
        raise LabConflictError("lab_paddle_binding_exists")
    evidence = verified_paddle_evidence(
        actor, request.values["evidence_ids"], list(prepare_paddle_command(actor, request).contexts)
    )
    binding = PaddleBagBinding.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        paddle=registered,
        cycle=revision + 1,
        previous=previous,
        bag=bag,
        source=bag.reading.event,
        issue_movement=source,
        command=command,
        evidence_ids=command.canonical_input["evidence_ids"],
        source_proof={
            "reading_id": str(bag.reading_id),
            "source_id": str(bag.reading.event_id),
            "source_hash": bag.reading.event.payload_sha256,
            "issue_effect_id": str(effect.pk),
            "receipt_line_id": str(effect.receipt_line_id),
        },
    )
    bind_paddle_evidence(command, evidence)
    return LabOutcome(
        201,
        {
            "binding": {
                "id": str(binding.pk),
                "paddle_id": str(registered.pk),
                "bag_id": str(bag.pk),
                "revision": binding.cycle,
            }
        },
    )


def reuse_frame(binding: PaddleBagBinding, actor: UploadActor | None = None) -> dict[str, Any]:
    """Actual current first/draw/request facts, never absence-as-clear or a field quantity."""
    bag = binding.bag
    current = LabResultRevision.objects.filter(bag=bag).first()
    if current is None or current.count_id is None:
        raise LabConflictError("lab_paddle_result_unavailable")
    count = current.count
    if actor is not None:
        publish_physical_assessment(actor, count)
    sample = (
        DailyRecountSample.objects.filter(
            organization=bag.organization,
            timezone=bag.organization.timezone,
            utc_from__lte=count.created_at,
            utc_before__gt=count.created_at,
        )
        .order_by("-created_at", "-revision")
        .first()
    )
    if sample is None or sample.rules.get("organization_revision") != bag.organization.revision:
        raise LabConflictError("lab_draw_unassessed")
    population = daily_population((bag.organization, sample.utc_from, sample.utc_before))
    fingerprint, size = population_fingerprint(population, sample.rules)
    member = DailyRecountSampleMember.objects.filter(sample=sample, count=count).first()
    if member is None or sample.frame_hash != fingerprint or sample.population != size:
        raise LabConflictError("lab_draw_unassessed")
    requests = RecountRequest.objects.filter(count__bag=bag, supersession__isnull=True)
    resolution = None
    for obligation in requests:
        from lab.independent_qa.selectors import obligation_resolution

        candidate = obligation_resolution(obligation, current)
        if candidate is None:
            raise LabConflictError("lab_recount_pending")
        resolution = candidate
    if member.selected and resolution is None:
        raise LabConflictError("lab_recount_pending")
    selected = (
        count
        if resolution is None or resolution.selected_count_id is not None
        else resolution.selected_attempt
    )
    if selected is None or selected.value != 0:
        raise LabConflictError("lab_paddle_positive_result")
    return {
        "result_revision_id": str(current.pk),
        "result_revision": current.revision,
        "count_id": str(count.pk),
        "resolution_id": None if resolution is None else str(resolution.pk),
        "qa_revision_id": None if resolution is None else str(resolution.qa_revision.pk),
        "qa_revision": 0 if resolution is None else resolution.qa_revision.revision,
        "sample_member_id": str(member.pk),
        "sample_frame_hash": fingerprint,
        "selected_attempt_id": str(selected.pk),
        "final_value": 0,
    }


def publish_physical_assessment(actor: UploadActor, count: EggCountAttempt | None) -> None:
    """Classifying a genuine physical result is an actual derived publication."""
    from lab.independent_qa.services import NumericPublication, publish_numeric_access

    if count is None:
        raise LabConflictError("lab_paddle_result_unavailable")
    publish_numeric_access(actor, count, NumericPublication(PADDLE_REUSE, "physical_assessment"))


def max_reuses(actor: UploadActor) -> dict[str, Any]:
    rows = cast(QuerySet[Any], list_parameters_with_current(actor.organization, server_now()))
    rule = (
        rows.filter(key="max_paddle_reuses")
        .values("current_value", "current_version_id", "value_type", "unit")
        .first()
    )
    value = None if rule is None else rule["current_value"]
    if (
        rule is None
        or value is None
        or value != int(value)
        or rule["value_type"] != "integer"
        or rule["unit"] != "count"
        or not 0 <= value <= 2
        or rule["current_version_id"] is None
    ):
        raise LabConflictError("lab_configuration_unavailable")
    return {"value": int(value), "version_id": str(rule["current_version_id"])}


def reuse_source(binding: PaddleBagBinding, source: StockMovement) -> None:
    if source.quantity == -1:
        effect = issue_effect(binding, source, binding.bag.reading)
        original = SupplyStockEffect.objects.get(movement=binding.issue_movement)
        if effect.receipt_line_id != original.receipt_line_id:
            raise LabConflictError("lab_paddle_issue_unproven")
        return
    received = SupplyStockEffect.objects.filter(
        movement=binding.issue_movement, kind="courier_credit"
    ).first()
    returned = SupplyStockEffect.objects.filter(
        movement=source,
        kind="return_credit",
        receipt_line_id=None if received is None else received.receipt_line_id,
    ).first()
    if (
        received is None
        or returned is None
        or returned.source.kind != "supply_return"
        or returned.source.execution_id is None
        or not ReturnAcceptance.objects.filter(
            execution=returned.source.execution,
            declaration__receipt_line_id=received.receipt_line_id,
            quantity=1,
        ).exists()
    ):
        raise LabConflictError("lab_paddle_custody_return_required")


def reuse_paddle(actor: UploadActor, command: LabCommand, request: LabCommandInput) -> LabOutcome:
    registered = paddle(actor, request.target.identifier)
    binding = get_object_or_404(registered.bindings.all(), pk=request.values["binding_id"])
    latest_binding = registered.bindings.first()
    if (
        request.values["expected_revision"] != binding.cycle
        or latest_binding is None
        or latest_binding.pk != binding.pk
    ):
        raise LabConflictError("lab_state_conflict", binding.cycle)
    if hasattr(binding, "reuse"):
        publish_physical_assessment(actor, binding.reuse.first_result.count)
        raise LabConflictError("lab_paddle_cycle_closed")
    require_physical_material(binding.bag)
    frame = reuse_frame(binding, actor)
    if (
        request.values["expected_result_revision"] != frame["result_revision"]
        or request.values["expected_qa_revision"] != frame["qa_revision"]
    ):
        raise LabConflictError("lab_state_conflict", frame["qa_revision"])
    policy = current_policy(actor.organization.pk)
    if policy.reuse_method_version_id != request.values["method_version"]:
        raise LabConflictError("lab_qa_configuration_unavailable")
    method, verification = configured_method(
        actor.organization.pk, request.values["method_version"], "paddle_reuse"
    )
    now = server_now()
    wash, dry = request.values["washed_at"], request.values["dried_at"]
    if (
        not isinstance(wash, datetime)
        or not isinstance(dry, datetime)
        or is_naive(wash)
        or is_naive(dry)
        or not wash <= dry <= now
    ):
        raise LabConflictError("lab_paddle_treatment_order")
    rule = max_reuses(actor)
    ordinal = PaddleReuse.objects.filter(binding__paddle=registered).count() + 1
    if ordinal > rule["value"]:
        raise LabConflictError("lab_paddle_reuse_limit")
    source = movement(actor, request.values["source_movement_id"])
    reuse_source(binding, source)
    evidence = verified_paddle_evidence(
        actor, request.values["evidence_ids"], list(prepare_paddle_command(actor, request).contexts)
    )
    reuse = PaddleReuse.objects.create(
        organization=actor.organization,
        created_by=actor.user,
        binding=binding,
        reuse_number=ordinal,
        first_result_id=frame["result_revision_id"],
        qa_revision_id=frame["qa_revision_id"],
        sample_member_id=frame["sample_member_id"],
        method_version=method,
        verification=verification,
        washed_at=request.values["washed_at"],
        dried_at=request.values["dried_at"],
        destination_id=request.values["destination_location_id"],
        source_movement=source,
        command=command,
        evidence_ids=command.canonical_input["evidence_ids"],
        frame_proof={"qa": frame, "reuse_rule": rule, "qa_policy_id": str(policy.pk)},
    )
    returned = append_paddle_return(reuse, source)
    bind_paddle_evidence(command, evidence)
    from lab.history import publish_qa_fact

    publish_qa_fact(reuse)
    operation = returned.stock_operation if returned.kind == "consumed" else source.operation
    credits = operation.movements.filter(
        quantity=1, piece=registered.piece, location=reuse.destination
    )
    return LabOutcome(
        201,
        {
            "reuse": {
                "id": str(reuse.pk),
                "paddle_id": str(registered.pk),
                "binding_id": str(binding.pk),
                "reuse_number": ordinal,
                "revision": binding.cycle,
                "stock_return_id": str(returned.pk),
                "stock_operation_id": str(operation.pk),
                "stock_movement_ids": [
                    str(identifier) for identifier in credits.values_list("pk", flat=True)
                ],
                "recovery_kind": returned.kind,
            }
        },
    )


def paddle_projection(registered: EggPaddle) -> dict[str, Any]:
    revision = getattr(registered, "current_cycle", None)
    if revision is None:
        current = registered.bindings.first()
        revision = 0 if current is None else current.cycle
    return {
        "id": str(registered.pk),
        "code": registered.code,
        "piece_id": str(registered.piece_id),
        "source_movement_id": str(registered.source_movement_id),
        "location_id": str(registered.location_id),
        "revision": revision,
        "created_at": registered.created_at.isoformat(),
    }


def reuse_projection(reuse: PaddleReuse) -> dict[str, Any]:
    returned = reuse.stock_return
    operation = (
        returned.stock_operation if returned.kind == "consumed" else reuse.source_movement.operation
    )
    credits = [
        str(row.pk)
        for row in operation.movements.all()
        if row.quantity == 1
        and row.piece_id == reuse.binding.paddle.piece_id
        and row.location_id == reuse.destination_id
    ]
    return {
        "id": str(reuse.pk),
        "paddle_id": str(reuse.binding.paddle_id),
        "binding_id": str(reuse.binding_id),
        "reuse_number": reuse.reuse_number,
        "revision": reuse.binding.cycle,
        "stock_return_id": str(returned.pk),
        "stock_operation_id": str(operation.pk),
        "stock_movement_ids": credits,
        "recovery_kind": returned.kind,
    }


def dispatch_paddle_command(
    actor: UploadActor, command: LabCommand, request: LabCommandInput
) -> LabOutcome:
    require_lab_lock(actor.organization.pk)
    return {
        "paddle_register": register_paddle,
        "paddle_bind": bind_paddle,
        "paddle_reuse": reuse_paddle,
    }[request.action](actor, command, request)
