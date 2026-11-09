"""Scoped reads and closed command adapters; no definition implies personal authority."""

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from core.exceptions import FieldValidationError
from core.filters import CodeLookupFilter
from core.permissions import HasPermissionCode
from core.table_filters import TableOrderingFilter
from core.time import server_now
from core.views import OrgScopedViewSetMixin
from organizations.services import effective_scope
from people import models, selectors
from people import serializers as wire
from people.eligibility import AssessmentQuery, assess_training_eligibility
from people.permissions import (
    EVALUATION_CREATE,
    EVALUATION_READ,
    TRAINING_MANAGE,
    TRAINING_READ,
    PeopleContext,
    active_subject,
    real_context,
    require_contexts,
)
from people.services import PeopleWrite, write_people
from uploads.access import actor_from_request, current_scope


@dataclass(frozen=True)
class CommandRoute:
    operation: str
    serializer: type[serializers.Serializer[Any]]
    target_id: UUID | None = None
    subject_id: UUID | None = None
    action: str | None = None


class PeopleViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet[Any]):
    serializer_class: type[serializers.Serializer[Any]]
    permission_classes = [IsAuthenticated, HasPermissionCode]
    permission_options: dict[str, tuple[str, ...]] = {}
    filter_backends = [CodeLookupFilter, TableOrderingFilter]
    ordering = ["-created_at", "id"]
    ordering_fields = ["created_at", "id"]
    read_permission: str
    filter_serializer_class: type[serializers.Serializer[Any]] = wire.PeopleContextFilterSerializer
    context_filter_fields = {"center": "center_id", "quadrant": "quadrant_id"}

    @property
    def required_permissions(self) -> dict[str, str]:
        """Select a declared alternative; selectors and commands still require the whole vector."""
        request = getattr(self, "request", None)
        membership = getattr(request, "membership", None)
        if request is None or membership is None:
            return {}
        action = getattr(self, "action", "")
        choices = self.permission_options.get(action, ())
        if (
            action == "list"
            and isinstance(self, CertificationViewSet)
            and request.query_params.get("proof") == "true"
        ):
            choices = (TRAINING_MANAGE,)
        scope = effective_scope(membership)
        for code in choices:
            if scope.allows(code):
                self.read_permission = code
                return {action: code}
        return {}

    def respond_list(self, rows: QuerySet[Any]) -> Response:
        page = self.paginate_queryset(self.filter_queryset(rows))
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def list(self, request: Request) -> Response:
        return self.respond_list(self.get_queryset())

    def command(self, request: Request, route: CommandRoute) -> Response:
        body = route.serializer(data=request.data)
        body.is_valid(raise_exception=True)
        values = dict(body.validated_data)
        identifier = values.pop("command_id")
        if route.subject_id is not None:
            values["subject_id"] = route.subject_id
        if route.action is not None:
            values["action"] = route.action
        answer = write_people(
            PeopleWrite(
                actor_from_request(request),
                identifier,
                route.operation,
                values,
                dict(request.data),
                route.target_id,
            )
        )
        return Response(wire.PeopleReceiptSerializer(answer).data, status=201)

    def filters(self) -> dict[str, Any]:
        allowed = self.filter_serializer_class().fields
        known = {"center", "quadrant", "subject", "training_version", "include_voided", "proof"}
        unsupported = known.intersection(self.request.query_params) - allowed.keys()
        if unsupported:
            raise FieldValidationError(sorted(unsupported)[0], "unsupported_filter")
        query = self.filter_serializer_class(
            data={key: value for key, value in self.request.query_params.items() if key in allowed}
        )
        query.is_valid(raise_exception=True)
        return dict(query.validated_data)

    def filter_context(self, rows: QuerySet[Any]) -> QuerySet[Any]:
        filters = self.filters()
        for key, lookup in self.context_filter_fields.items():
            if key in filters:
                rows = rows.filter(**{lookup: filters[key]})
        return rows


class TrainingViewSet(PeopleViewSet):
    serializer_class: type[serializers.Serializer[Any]] = wire.TrainingReadSerializer
    permission_options = {
        "list": (TRAINING_READ, TRAINING_MANAGE),
        "create": (TRAINING_MANAGE,),
        "versions": (TRAINING_READ, TRAINING_MANAGE),
        "publish_version": (TRAINING_MANAGE,),
    }
    code_lookup_field = "code"
    ordering = ["code", "id"]
    ordering_fields = ["code", "name", "created_at", "id"]

    def get_queryset(self) -> QuerySet[models.Training]:
        if getattr(self, "swagger_fake_view", False):
            return models.Training.objects.none()
        return selectors.training_definitions(actor_from_request(self.request).organization.pk)

    def list(self, request: Request) -> Response:
        return self.respond_list(self.get_queryset())

    @extend_schema(
        request=wire.IdentityWriteSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def create(self, request: Request) -> Response:
        return self.command(request, CommandRoute("training.create", wire.IdentityWriteSerializer))

    @extend_schema(responses=wire.TrainingVersionReadSerializer(many=True))
    def versions(self, request: Request, pk: UUID) -> Response:
        parent = self.get_object()
        rows = models.TrainingVersion.objects.filter(training=parent).order_by("version", "id")
        self.serializer_class = wire.TrainingVersionReadSerializer
        return self.respond_list(rows)

    @extend_schema(
        request=wire.TrainingVersionWriteSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def publish_version(self, request: Request, pk: UUID) -> Response:
        return self.command(
            request, CommandRoute("training.version", wire.TrainingVersionWriteSerializer, pk)
        )


class RubricViewSet(PeopleViewSet):
    serializer_class: type[serializers.Serializer[Any]] = wire.RubricReadSerializer
    code_lookup_field = "code"
    ordering = ["code", "id"]
    ordering_fields = ["code", "name", "created_at", "id"]
    permission_options = {
        "list": (EVALUATION_CREATE, EVALUATION_READ, TRAINING_MANAGE),
        "create": (TRAINING_MANAGE,),
        "versions": (EVALUATION_CREATE, EVALUATION_READ, TRAINING_MANAGE),
        "publish_version": (TRAINING_MANAGE,),
    }

    def get_queryset(self) -> QuerySet[models.EvaluationRubric]:
        if getattr(self, "swagger_fake_view", False):
            return models.EvaluationRubric.objects.none()
        return selectors.rubric_definitions(actor_from_request(self.request).organization.pk)

    @extend_schema(
        request=wire.IdentityWriteSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def create(self, request: Request) -> Response:
        return self.command(request, CommandRoute("rubric.create", wire.IdentityWriteSerializer))

    @extend_schema(responses=wire.RubricVersionReadSerializer(many=True))
    def versions(self, request: Request, pk: UUID) -> Response:
        parent = self.get_object()
        self.serializer_class = wire.RubricVersionReadSerializer
        return self.respond_list(
            models.EvaluationRubricVersion.objects.filter(rubric=parent).order_by("version", "id")
        )

    @extend_schema(
        request=wire.RubricVersionWriteSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def publish_version(self, request: Request, pk: UUID) -> Response:
        return self.command(
            request, CommandRoute("rubric.version", wire.RubricVersionWriteSerializer, pk)
        )


class RequirementViewSet(PeopleViewSet):
    serializer_class = wire.RequirementReadSerializer
    permission_options = {
        "list": (TRAINING_READ, TRAINING_MANAGE),
        "publish_version": (TRAINING_MANAGE,),
    }

    def get_queryset(self) -> QuerySet[models.ActionTrainingRequirementVersion]:
        if getattr(self, "swagger_fake_view", False):
            return models.ActionTrainingRequirementVersion.objects.none()
        actor = actor_from_request(self.request)
        return selectors.scoped_facts(
            models.ActionTrainingRequirementVersion.objects.filter(organization=actor.organization),
            current_scope(actor),
            self.read_permission,
        ).order_by("action", "-revision", "id")

    @extend_schema(parameters=[wire.PeopleContextFilterSerializer])
    def list(self, request: Request) -> Response:
        return self.respond_list(self.filter_context(self.get_queryset()))

    @extend_schema(
        request=wire.RequirementWriteSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def publish_version(self, request: Request, action_key: str) -> Response:
        return self.command(
            request,
            CommandRoute("requirement.version", wire.RequirementWriteSerializer, action=action_key),
        )


class NoticePolicyViewSet(PeopleViewSet):
    serializer_class = wire.NoticePolicyReadSerializer
    permission_options = {"list": (EVALUATION_READ,), "publish_version": (TRAINING_MANAGE,)}

    def get_queryset(self) -> QuerySet[models.EvaluationNoticePolicyVersion]:
        if getattr(self, "swagger_fake_view", False):
            return models.EvaluationNoticePolicyVersion.objects.none()
        actor = actor_from_request(self.request)
        scope = current_scope(actor)
        rows: QuerySet[models.EvaluationNoticePolicyVersion] = (
            models.EvaluationNoticePolicyVersion.objects.filter(organization=actor.organization)
        )
        for permission in (TRAINING_MANAGE, EVALUATION_READ):
            rows = selectors.scoped_facts(rows, scope, permission)
        return rows.order_by("-revision", "id")

    @extend_schema(parameters=[wire.PeopleContextFilterSerializer])
    def list(self, request: Request) -> Response:
        return self.respond_list(self.filter_context(self.get_queryset()))

    @extend_schema(
        request=wire.NoticePolicyWriteSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def publish_version(self, request: Request) -> Response:
        return self.command(
            request, CommandRoute("notice_policy.version", wire.NoticePolicyWriteSerializer)
        )


class CertificationViewSet(PeopleViewSet):
    filter_serializer_class = wire.CertificationListFilterSerializer
    context_filter_fields = {
        **PeopleViewSet.context_filter_fields,
        "training_version": "training_version_id",
    }
    serializer_class: type[serializers.Serializer[Any]] = wire.CertificationSummarySerializer
    permission_options = {
        "list": (TRAINING_READ, TRAINING_MANAGE),
        "create": (TRAINING_MANAGE,),
        "revoke": (TRAINING_MANAGE,),
        "revocations": (TRAINING_MANAGE,),
    }

    def get_queryset(self) -> QuerySet[models.Certification]:
        if getattr(self, "swagger_fake_view", False):
            return models.Certification.objects.none()
        return selectors.subject_certifications(
            actor_from_request(self.request), self.kwargs["subject_id"], self.read_permission
        )

    def _require_subject(self, rows: QuerySet[models.Certification]) -> None:
        if rows.exists():
            return
        actor = actor_from_request(self.request)
        filters = self.filters()
        if "center" not in filters:
            raise Http404
        context = real_context(actor, filters["center"], filters.get("quadrant"))
        require_contexts(actor, self.read_permission, (context,))
        active_subject(actor, self.kwargs["subject_id"], context)

    @extend_schema(
        parameters=[wire.CertificationListFilterSerializer],
        responses=wire.CertificationSummarySerializer(many=True),
    )
    def list(self, request: Request, subject_id: UUID | None = None) -> Response:
        filters = self.filters()
        rows = self.get_queryset()
        self._require_subject(rows)
        if filters["proof"] == "true":
            self.serializer_class = wire.CertificationProofSerializer
        return self.respond_list(self.filter_context(rows))

    @extend_schema(
        request=wire.CertificationWriteSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def create(self, request: Request, subject_id: UUID) -> Response:
        return self.command(
            request,
            CommandRoute(
                "certification.issue", wire.CertificationWriteSerializer, subject_id=subject_id
            ),
        )

    @extend_schema(
        request=wire.CertificationRevokeSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def revoke(self, request: Request, subject_id: UUID, certification_id: UUID) -> Response:
        if not self.get_queryset().filter(pk=certification_id).exists():
            raise Http404
        return self.command(
            request,
            CommandRoute(
                "certification.revoke",
                wire.CertificationRevokeSerializer,
                certification_id,
                subject_id,
            ),
        )

    @extend_schema(responses=wire.CertificationRevocationReadSerializer(many=True))
    def revocations(self, request: Request, subject_id: UUID, certification_id: UUID) -> Response:
        parent = self.get_queryset().filter(pk=certification_id).first()
        if parent is None:
            raise Http404
        self.serializer_class = wire.CertificationRevocationReadSerializer
        self.ordering = ["revision", "id"]
        self.ordering_fields = ["revision", "effective_from", "created_at", "id"]
        return self.respond_list(
            models.CertificationRevocation.objects.filter(certification=parent)
        )


class EvaluationViewSet(PeopleViewSet):
    filter_serializer_class = wire.EvaluationListFilterSerializer
    context_filter_fields = {**PeopleViewSet.context_filter_fields, "subject": "subject_id"}
    serializer_class: type[serializers.Serializer[Any]] = wire.EvaluationReadSerializer
    permission_options = {
        "list": (EVALUATION_READ,),
        "create": (EVALUATION_CREATE,),
        "revise": (EVALUATION_CREATE,),
        "void": (EVALUATION_CREATE,),
        "attempts": (EVALUATION_READ,),
    }

    def get_queryset(self) -> QuerySet[models.Evaluation]:
        if getattr(self, "swagger_fake_view", False):
            return models.Evaluation.objects.none()
        return selectors.scoped_evaluations(actor_from_request(self.request), EVALUATION_READ)

    def get_serializer_context(self) -> dict[str, Any]:
        return {**super().get_serializer_context(), "attempts": getattr(self, "read_attempts", {})}

    @extend_schema(parameters=[wire.EvaluationListFilterSerializer])
    def list(self, request: Request) -> Response:
        rows = self.filter_context(self.get_queryset())
        if self.filters()["include_voided"] != "true":
            rows = rows.filter(_is_voided=False)
        page = list(self.paginate_queryset(self.filter_queryset(rows)) or [])
        self.read_attempts = selectors.read_attempts(page)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(
        request=wire.EvaluationCreateSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def create(self, request: Request) -> Response:
        return self.command(
            request, CommandRoute("evaluation.create", wire.EvaluationCreateSerializer)
        )

    @extend_schema(
        request=wire.EvaluationRevisionSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def revise(self, request: Request, pk: UUID) -> Response:
        return self.command(
            request, CommandRoute("evaluation.revise", wire.EvaluationRevisionSerializer, pk)
        )

    @extend_schema(
        request=wire.EvaluationVoidSerializer, responses={201: wire.PeopleReceiptSerializer}
    )
    def void(self, request: Request, pk: UUID) -> Response:
        return self.command(
            request, CommandRoute("evaluation.void", wire.EvaluationVoidSerializer, pk)
        )

    @extend_schema(responses=wire.EvaluationAttemptReadSerializer(many=True))
    def attempts(self, request: Request, pk: UUID) -> Response:
        parent = self.get_object()
        self.serializer_class = wire.EvaluationAttemptReadSerializer
        self.ordering = ["revision", "id"]
        self.ordering_fields = ["revision", "observed_at", "created_at", "id"]
        return self.respond_list(
            models.EvaluationAttempt.objects.filter(evaluation=parent).select_related("completion")
        )


class EligibilityViewSet(PeopleViewSet):
    serializer_class = wire.EligibilityReadSerializer
    permission_options = {"retrieve": (TRAINING_READ,)}

    @extend_schema(
        parameters=[wire.EligibilityQuerySerializer], responses=wire.EligibilityReadSerializer
    )
    def retrieve(self, request: Request, subject_id: UUID) -> Response:
        query = wire.EligibilityQuerySerializer(
            data={
                key: value
                for key, value in request.query_params.items()
                if key in wire.EligibilityQuerySerializer().fields
            }
        )
        query.is_valid(raise_exception=True)
        values = query.validated_data
        actor = actor_from_request(request)
        context = PeopleContext(values["center_id"], values.get("quadrant_id"))
        require_contexts(actor, TRAINING_READ, (context,))
        visible = selectors.subject_certifications(actor, subject_id, TRAINING_READ).filter(
            **context.lookups()
        )
        if not visible.exists():
            active_subject(
                actor, subject_id, real_context(actor, context.center_id, context.quadrant_id)
            )
        now = server_now()
        at = values.get("at", now)
        answer = assess_training_eligibility(
            AssessmentQuery(actor.organization, subject_id, values["action"], context, at, now)
        )
        answer["query_kind"] = (
            "current" if "at" not in values else "retrospective" if at < now else "future"
        )
        return Response(wire.EligibilityReadSerializer(answer).data)
