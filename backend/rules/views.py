from typing import Any

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.filters import CodeLookupFilter
from core.snapshots import IF_NONE_MATCH_PARAMETER, snapshot_response
from core.table_filters import TableOrderingFilter, TableSearchFilter
from core.views import OrgScopedViewSetMixin
from core.void_reason import VoidSerializer
from rules.models import RuleParameter, RuleParameterVersion
from rules.permissions import (
    RULE_PARAMETER_READ,
    RULE_PARAMETER_VERSION_CREATE,
    RULE_PARAMETER_VERSION_READ,
    RULE_PARAMETER_VERSION_VOID,
)
from rules.selectors import build_rules_snapshot, list_parameters_with_current, list_versions
from rules.serializers import (
    ParameterFilterSerializer,
    RuleParameterSerializer,
    RuleParameterVersionCreateSerializer,
    RuleParameterVersionSerializer,
    RulesSnapshotSerializer,
    VersionFilterSerializer,
)
from rules.services import RuleVersionSpec, create_rule_version, void_rule_version

KEY_REGEX = "[a-z][a-z0-9_]*"


class RuleParameterViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Parameters of the organization with their current value. They are created by the seed."""

    queryset = RuleParameter.objects.all()
    serializer_class = RuleParameterSerializer
    lookup_field = "key"
    lookup_value_regex = KEY_REGEX
    required_permissions = {"list": RULE_PARAMETER_READ, "retrieve": RULE_PARAMETER_READ}
    filter_backends = [CodeLookupFilter, TableSearchFilter, TableOrderingFilter]
    search_fields = ["key"]
    ordering_fields = ["key", "unit", "value_type", "effective_from"]
    ordering_aliases = {"effective_from": "current_effective_from"}
    ordering = ["key"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return RuleParameter.objects.none()
        # Organization isolation: the selector filters by organization (it does not go through
        # the mixin's `for_org`), so any queryset built here must keep doing so.
        queryset = list_parameters_with_current(self.request.organization, timezone.now())  # type: ignore[attr-defined]
        if self.action == "list":
            query = ParameterFilterSerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            queryset = queryset.filter(**query.validated_data)
        return queryset

    @extend_schema(parameters=[ParameterFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)


class RulesSnapshotViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """`GET /field/rules/`: the values in force now, for phones to keep offline."""

    queryset = RuleParameter.objects.all()
    serializer_class = RulesSnapshotSerializer
    pagination_class = None
    required_permissions = {"list": RULE_PARAMETER_READ}

    @extend_schema(
        parameters=[IF_NONE_MATCH_PARAMETER],
        responses={200: RulesSnapshotSerializer, 304: None},
    )
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        snapshot = build_rules_snapshot(request.organization, timezone.now())  # type: ignore[attr-defined]
        return snapshot_response(request, snapshot)


class RuleParameterVersionViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """History of `/rule-parameters/{parameter_key}/versions/`: add a version, never edit one.

    A version that has not taken effect yet can be voided (`POST .../{id}/void/`). The detail
    route also makes PUT, PATCH and DELETE answer 405 instead of 404.
    """

    queryset = RuleParameterVersion.objects.all()
    serializer_class = RuleParameterVersionSerializer
    filter_backends = [CodeLookupFilter, TableSearchFilter, TableOrderingFilter]
    search_fields = ["reason"]
    ordering_fields = ["effective_from", "created_at", "value"]
    ordering = ["-effective_from", "-created_at"]
    http_method_names = ["get", "post", "head", "options"]
    required_permissions = {
        "list": RULE_PARAMETER_VERSION_READ,
        "retrieve": RULE_PARAMETER_VERSION_READ,
        "create": RULE_PARAMETER_VERSION_CREATE,
        "void": RULE_PARAMETER_VERSION_VOID,
    }

    def get_parameter(self) -> RuleParameter:
        """The parameter of the URL; another organization's key is a 404 like an unknown one."""
        if not hasattr(self, "_parameter"):
            scoped = RuleParameter.objects.for_org(self.request.organization)  # type: ignore[attr-defined]
            self._parameter = get_object_or_404(scoped, key=self.kwargs["parameter_key"])
        return self._parameter  # type: ignore[no-any-return]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return RuleParameterVersion.objects.none()
        include_voided = True
        if self.action == "list":
            query = VersionFilterSerializer(data=self.request.query_params.dict())
            query.is_valid(raise_exception=True)
            include_voided = query.validated_data["include_voided"] == "true"
        queryset = list_versions(
            self.get_parameter(), timezone.now(), include_voided=include_voided
        )
        if self.action == "list" and (version_status := query.validated_data.get("status")):
            queryset = queryset.filter(**{"status": version_status})
        return queryset

    def get_serializer_class(self) -> type[serializers.BaseSerializer[Any]]:
        if self.action == "create":
            return RuleParameterVersionCreateSerializer
        return RuleParameterVersionSerializer

    @extend_schema(parameters=[VersionFilterSerializer])
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().list(request, *args, **kwargs)

    @extend_schema(
        request=RuleParameterVersionCreateSerializer,
        responses={201: RuleParameterVersionSerializer},
    )
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = self.get_serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        spec = RuleVersionSpec(data["value"], data["effective_from"], data["reason"])
        version = create_rule_version(self.get_parameter(), spec, request.user)  # type: ignore[arg-type]
        return Response(self._read(version), status=status.HTTP_201_CREATED)

    @extend_schema(request=VoidSerializer, responses={200: RuleParameterVersionSerializer})
    @action(detail=True, methods=["post"])
    def void(self, request: Request, *args: object, **kwargs: object) -> Response:
        version = self.get_object()
        payload = VoidSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        void_rule_version(version, request.user, **payload.validated_data)  # type: ignore[arg-type]
        return Response(self._read(version))

    def _read(self, version: RuleParameterVersion) -> Any:  # noqa: ANN401
        stored = self.get_queryset().get(pk=version.pk)
        return RuleParameterVersionSerializer(stored, context=self.get_serializer_context()).data
