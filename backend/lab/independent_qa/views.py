"""Thin QA routes; action alternatives never merge grant dimensions."""

from typing import Any, cast
from uuid import UUID

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from core.permissions import HasPermissionCode
from lab.access import LabTarget
from lab.commands import LabCommandInput, execute_lab_command
from lab.independent_qa import serializers as qa_serializers
from lab.independent_qa.commands import action_alternatives
from lab.independent_qa.selectors import (
    execution_rows,
    policy_projection,
    queue_projection,
    request_for_action,
)
from lab.independent_qa.serializers import (
    IndependenceAttestationOutcomeSerializer,
    IndependenceAttestationSerializer,
    LabQAPolicyContextSerializer,
    LabQAPolicyWriteSerializer,
    RecountClaimOutcomeSerializer,
    RecountClaimSerializer,
    RecountDecisionOutcomeSerializer,
    RecountDecisionSerializer,
    RecountQuerySerializer,
    RecountQueueSerializer,
)
from lab.independent_qa.services import write_qa_policy
from lab.models import EggPaddle, LabQAPolicyVersion, PaddleReuse
from lab.permissions import (
    METHOD_MANAGE,
    METHOD_READ,
    PADDLE_REUSE,
    RECOUNT_ADJUDICATE,
    RECOUNT_CREATE,
)
from lab.views import LabReadViewSet
from uploads.access import actor_from_request, current_scope


class RecountActionPermission(HasPermissionCode):
    """The canonical action guard, with the one adopted create-or-adjudicate alternative."""

    def has_permission(self, request: Request, view: Any) -> bool:  # noqa: ANN401 -- DRF view protocol
        if view.action in {"list", "adjudicate"}:
            scope = current_scope(actor_from_request(request))
            return scope.allows(RECOUNT_CREATE) or scope.allows(RECOUNT_ADJUDICATE)
        return super().has_permission(request, view)


class RecountViewSet(LabReadViewSet):
    serializer_class = RecountQueueSerializer
    query_serializer_class = RecountQuerySerializer
    permission_classes = [IsAuthenticated, RecountActionPermission]
    required_permissions = {
        "list": RECOUNT_CREATE,
        "claim": RECOUNT_CREATE,
        "adjudicate": RECOUNT_ADJUDICATE,
        "independence_attestations": RECOUNT_ADJUDICATE,
    }

    @extend_schema(parameters=[RecountQuerySerializer])
    def list(self, request: Request) -> Response:
        return self.page_response(
            execution_rows(actor_from_request(request), self.read_query()), queue_projection
        )

    def command_response(
        self,
        request: Request,
        pk: str | None,
        operation: tuple[str, type[serializers.Serializer[Any]]],
    ) -> Response:
        action_name, owner = operation
        actor = actor_from_request(request)
        identifier = UUID(str(pk))
        request_for_action(actor, identifier, action_alternatives(action_name))
        payload = owner(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        command_id = values.pop("command_id")
        outcome = execute_lab_command(
            actor,
            LabCommandInput(action_name, LabTarget("recount", identifier), command_id, values),
        )
        return Response(outcome.body, status=outcome.status)

    @extend_schema(request=RecountClaimSerializer, responses={201: RecountClaimOutcomeSerializer})
    @action(detail=True, methods=["post"])
    def claim(self, request: Request, pk: str | None = None) -> Response:
        return self.command_response(request, pk, ("recount_claim", RecountClaimSerializer))

    @extend_schema(
        request=RecountDecisionSerializer, responses={201: RecountDecisionOutcomeSerializer}
    )
    @action(detail=True, methods=["post"])
    def adjudicate(self, request: Request, pk: str | None = None) -> Response:
        return self.command_response(request, pk, ("recount_adjudicate", RecountDecisionSerializer))

    @extend_schema(
        request=IndependenceAttestationSerializer,
        responses={201: IndependenceAttestationOutcomeSerializer},
    )
    @action(detail=True, methods=["post"], url_path="independence-attestations")
    def independence_attestations(self, request: Request, pk: str | None = None) -> Response:
        return self.command_response(
            request, pk, ("recount_attest", IndependenceAttestationSerializer)
        )


class LabQAPolicyViewSet(LabReadViewSet):
    serializer_class = LabQAPolicyContextSerializer
    required_permissions = {"list": METHOD_READ, "versions": METHOD_MANAGE}

    def list(self, request: Request) -> Response:
        return Response(
            policy_projection(
                LabQAPolicyVersion.objects.filter(
                    organization=actor_from_request(request).organization
                ).first()
            )
        )

    @extend_schema(
        request=LabQAPolicyWriteSerializer, responses={201: LabQAPolicyContextSerializer}
    )
    @action(detail=False, methods=["post"])
    def versions(self, request: Request) -> Response:
        payload = LabQAPolicyWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        policy = write_qa_policy(actor_from_request(request), dict(payload.validated_data))
        return Response(policy_projection(policy), status=201)


class EggPaddleViewSet(LabReadViewSet):
    serializer_class = qa_serializers.PaddleSerializer
    query_serializer_class = qa_serializers.PaddleQuerySerializer
    required_permissions = {
        "list": PADDLE_REUSE,
        "create": PADDLE_REUSE,
        "bindings": PADDLE_REUSE,
        "reuses": PADDLE_REUSE,
    }

    @extend_schema(parameters=[qa_serializers.PaddleQuerySerializer])
    def list(self, request: Request) -> Response:
        from lab.independent_qa.paddles import paddle_projection
        from lab.independent_qa.selectors import paddle_rows

        return self.page_response(
            paddle_rows(actor_from_request(request), self.read_query()), paddle_projection
        )

    def command_response(
        self,
        request: Request,
        identifier: UUID,
        operation: tuple[str, type[serializers.Serializer[Any]]],
    ) -> Response:
        command_name, owner = operation
        payload = owner(data=request.data)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        command_id = values.pop("command_id")
        outcome = execute_lab_command(
            actor_from_request(request),
            LabCommandInput(command_name, LabTarget("paddle", identifier), command_id, values),
        )
        return Response(outcome.body, status=outcome.status)

    @extend_schema(
        request=qa_serializers.PaddleRegistrationSerializer,
        responses={201: qa_serializers.PaddleRegistrationOutcomeSerializer},
    )
    def create(self, request: Request) -> Response:
        payload = qa_serializers.PaddleRegistrationSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return self.command_response(
            request,
            payload.validated_data["piece_id"],
            ("paddle_register", qa_serializers.PaddleRegistrationSerializer),
        )

    def scoped_paddle_id(self, pk: str | None) -> UUID:
        from lab.independent_qa.selectors import paddle_rows

        return cast(
            UUID, get_object_or_404(paddle_rows(actor_from_request(self.request), {}), pk=pk).pk
        )

    def command_paddle_id(self, pk: str | None) -> UUID:
        """Dispatch by tenant identity; the command owner checks its exact current subjects."""
        return cast(
            UUID,
            get_object_or_404(
                EggPaddle.objects.filter(
                    organization=actor_from_request(self.request).organization
                ),
                pk=pk,
            ).pk,
        )

    @extend_schema(
        request=qa_serializers.PaddleBindingSerializer,
        responses={201: qa_serializers.PaddleBindingOutcomeSerializer},
    )
    @action(detail=True, methods=["post"])
    def bindings(self, request: Request, pk: str | None = None) -> Response:
        return self.command_response(
            request,
            self.command_paddle_id(pk),
            ("paddle_bind", qa_serializers.PaddleBindingSerializer),
        )

    @extend_schema(
        methods=["POST"],
        request=qa_serializers.PaddleReuseSerializer,
        responses={201: qa_serializers.PaddleReuseOutcomeSerializer},
    )
    @extend_schema(
        methods=["GET"],
        responses=qa_serializers.PaddleReuseReceiptSerializer(many=True),
        parameters=[qa_serializers.PaddleReuseQuerySerializer],
    )
    @action(detail=True, methods=["get", "post"])
    def reuses(self, request: Request, pk: str | None = None) -> Response:
        if request.method == "POST":
            return self.command_response(
                request,
                self.command_paddle_id(pk),
                ("paddle_reuse", qa_serializers.PaddleReuseSerializer),
            )
        identifier = self.scoped_paddle_id(pk)
        from lab.independent_qa.paddles import reuse_projection

        query = qa_serializers.PaddleReuseQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)

        rows = (
            PaddleReuse.objects.filter(
                organization=actor_from_request(request).organization, binding__paddle_id=identifier
            )
            .select_related(
                "binding__paddle",
                "stock_return__stock_operation",
                "source_movement__operation",
            )
            .prefetch_related(
                "stock_return__stock_operation__movements", "source_movement__operation__movements"
            )
            .order_by(query.validated_data.get("ordering", "created_at"), "id")
        )
        return self.page_response(rows, reuse_projection)
