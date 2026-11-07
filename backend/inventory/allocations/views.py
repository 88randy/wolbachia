"""Session/CSRF facades; current scoped selectors and immutable commands own behavior."""

from collections.abc import Callable
from typing import Any, cast
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from core.permissions import HasPermissionCode
from core.views import OrgScopedViewSetMixin
from inventory.allocations.commands import (
    AssignmentWrite,
    ConfigurationWrite,
    IntentExecution,
    IntentKind,
)
from inventory.allocations.intents import (
    execute_inventory_intent,
    get_inventory_intent,
    prepare_inventory_intent,
)
from inventory.allocations.models import (
    CourierTransitPolicyVersion,
    InventoryIntent,
    InventoryIntentExecution,
    Reconciliation,
    SupplyAssignment,
    SupplyMaterialMappingVersion,
)
from inventory.allocations.permissions import (
    ALLOCATE,
    BAG_DISPOSE,
    RECEIVE_OWN,
    RECONCILE,
    RECONCILE_OWN,
    WRITE_OFF,
)
from inventory.allocations.selectors import (
    assignment_projection,
    assignment_rows,
    get_write_off,
    reconciliation_projection,
    reconciliation_rows,
    write_off_rows,
)
from inventory.allocations.serializers import (
    AssignmentOutcomeSerializer,
    CancellationOutcomeSerializer,
    CreateAssignmentSerializer,
    ExecuteInventoryIntentSerializer,
    InventoryIntentReadSerializer,
    JustificationOutcomeSerializer,
    MaterialMappingSerializer,
    PreparedIntentOutcomeSerializer,
    PrepareInventoryIntentSerializer,
    ReleaseOutcomeSerializer,
    ReturnAcceptanceOutcomeSerializer,
    ReviseAssignmentSerializer,
    SupplyAssignmentReadSerializer,
    SupplyConfigurationReadSerializer,
    SupplyQuerySerializer,
    SupplyReconciliationSerializer,
    SupplySuggestionQuerySerializer,
    SupplySuggestionSerializer,
    TransitPolicySerializer,
    WriteOffOutcomeSerializer,
    WriteOffQuerySerializer,
    WriteOffReadSerializer,
)
from inventory.allocations.services import write_assignment
from inventory.allocations.suggestions import material_suggestion
from inventory.allocations.transit import publish_transit_configuration
from inventory.models import SupplyType
from organizations.services import effective_scope
from uploads.access import actor_from_request, current_scope


class SupplyViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet[Any]):
    permission_classes = [IsAuthenticated, HasPermissionCode]
    http_method_names = ["get", "post", "head", "options"]
    supply_actions: dict[str, tuple[str, ...]] = {}
    lookup_value_regex = (
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    )
    query_serializer: type[serializers.Serializer[Any]] = SupplyQuerySerializer

    @property
    def required_permissions(self) -> dict[str, str]:
        """Choose a declared action alternative; concrete selectors still require its full vector."""
        membership = getattr(getattr(self, "request", None), "membership", None)
        if membership is None:
            return {}
        scope = effective_scope(membership)
        for code in self.supply_actions.get(self.action, ()):
            if scope.allows(code):
                return {self.action: code}
        return {}

    def _query(
        self, serializer_type: type[serializers.Serializer[Any]] | None = None
    ) -> dict[str, Any]:
        serializer_type = self.query_serializer if serializer_type is None else serializer_type
        fields = dict(serializer_type().fields)
        for field in fields:
            if len(self.request.query_params.getlist(field)) > 1:
                raise serializers.ValidationError({field: ["invalid"]})
        value = serializer_type(data=self.request.query_params.dict())
        value.is_valid(raise_exception=True)
        return dict(value.validated_data)

    def _list_rows(self, rows: QuerySet[Any], project: Callable[[Any], dict[str, Any]]) -> Response:
        page = self.paginate_queryset(rows)
        body = [project(row) for row in (rows if page is None else page)]
        return Response(body) if page is None else self.get_paginated_response(body)

    def _execute(self, request: Request, command: tuple[IntentKind, UUID | None]) -> Response:
        body = ExecuteInventoryIntentSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = execute_inventory_intent(
            actor_from_request(request),
            IntentExecution(body.validated_data["intent_id"], command[0], command[1]),
        )
        return Response(result.body, status=result.status)


class SupplyAssignmentViewSet(SupplyViewSet):
    queryset = SupplyAssignment.objects.none()
    serializer_class = SupplyAssignmentReadSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    supply_actions = {
        "list": (ALLOCATE, RECONCILE, RECEIVE_OWN, RECONCILE_OWN),
        "retrieve": (ALLOCATE, RECONCILE, RECEIVE_OWN, RECONCILE_OWN),
        "create": (ALLOCATE,),
        "partial_update": (ALLOCATE,),
        "release": (ALLOCATE,),
        "release_cancellations": (ALLOCATE,),
        "suggestion": (ALLOCATE,),
    }

    @extend_schema(
        parameters=[SupplyQuerySerializer], responses=SupplyAssignmentReadSerializer(many=True)
    )
    def list(self, request: Request) -> Response:
        return self._list_rows(
            assignment_rows(actor_from_request(request), self._query()), assignment_projection
        )

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        if pk is None:
            raise Http404
        row = assignment_rows(actor_from_request(request), {}).filter(pk=pk).first()
        if row is None:
            raise Http404
        return Response(assignment_projection(row))

    @extend_schema(request=CreateAssignmentSerializer, responses={201: AssignmentOutcomeSerializer})
    def create(self, request: Request) -> Response:
        body = CreateAssignmentSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = write_assignment(
            AssignmentWrite(actor_from_request(request), dict(body.validated_data))
        )
        return Response(result.body, status=result.status)

    @extend_schema(request=ReviseAssignmentSerializer, responses={201: AssignmentOutcomeSerializer})
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        if pk is None:
            raise Http404
        actor = actor_from_request(request)
        parent = assignment_rows(actor, {}).filter(pk=pk).first()
        if parent is None:
            raise Http404
        body = ReviseAssignmentSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        values = {
            **body.validated_data,
            "courier_id": parent.courier_id,
            "origin_id": parent.origin_id,
            "date": parent.date,
            "shift_id": parent.shift_id,
        }
        result = write_assignment(AssignmentWrite(actor, values, parent.pk))
        return Response(result.body, status=result.status)

    @extend_schema(
        request=ExecuteInventoryIntentSerializer, responses={201: ReleaseOutcomeSerializer}
    )
    @action(detail=True, methods=["post"])
    def release(self, request: Request, pk: str | None = None) -> Response:
        return self._execute(request, ("assignment_release", UUID(str(pk))))

    @extend_schema(
        request=ExecuteInventoryIntentSerializer, responses={201: CancellationOutcomeSerializer}
    )
    @action(detail=True, methods=["post"], url_path="release-cancellations")
    def release_cancellations(self, request: Request, pk: str | None = None) -> Response:
        return self._execute(request, ("release_cancel", UUID(str(pk))))

    @extend_schema(
        parameters=[SupplySuggestionQuerySerializer], responses=SupplySuggestionSerializer
    )
    @action(detail=False, methods=["get"])
    def suggestion(self, request: Request) -> Response:
        query = self._query(SupplySuggestionQuerySerializer)
        return Response(
            material_suggestion(actor_from_request(request), query["date"], query.get("courier"))
        )


class SupplyReconciliationViewSet(SupplyViewSet):
    queryset = Reconciliation.objects.none()
    serializer_class = SupplyReconciliationSerializer
    supply_actions = {
        "list": (RECONCILE, RECONCILE_OWN),
        "retrieve": (RECONCILE, RECONCILE_OWN),
        "accept_return": (RECONCILE,),
        "justify": (RECONCILE,),
    }

    @extend_schema(
        parameters=[SupplyQuerySerializer], responses=SupplyReconciliationSerializer(many=True)
    )
    def list(self, request: Request) -> Response:
        return self._list_rows(
            reconciliation_rows(actor_from_request(request), self._query()),
            reconciliation_projection,
        )

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        if pk is None:
            raise Http404
        row = reconciliation_rows(actor_from_request(request), {}).filter(pk=pk).first()
        if row is None:
            raise Http404
        return Response(reconciliation_projection(row))

    @extend_schema(
        request=ExecuteInventoryIntentSerializer, responses={201: ReturnAcceptanceOutcomeSerializer}
    )
    @action(detail=True, methods=["post"], url_path="returns/accept")
    def accept_return(self, request: Request, pk: str | None = None) -> Response:
        return self._execute(request, ("return_accept", UUID(str(pk))))

    @extend_schema(
        request=ExecuteInventoryIntentSerializer, responses={201: JustificationOutcomeSerializer}
    )
    @action(detail=True, methods=["post"])
    def justify(self, request: Request, pk: str | None = None) -> Response:
        return self._execute(request, ("reconcile_justify", UUID(str(pk))))


class InventoryIntentViewSet(SupplyViewSet):
    queryset = InventoryIntent.objects.none()
    serializer_class = InventoryIntentReadSerializer
    supply_actions = {
        "create": (ALLOCATE, RECONCILE, WRITE_OFF, BAG_DISPOSE),
        "retrieve": (ALLOCATE, RECONCILE, WRITE_OFF, BAG_DISPOSE),
    }

    @extend_schema(
        request=PrepareInventoryIntentSerializer, responses={201: PreparedIntentOutcomeSerializer}
    )
    def create(self, request: Request) -> Response:
        body = PrepareInventoryIntentSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        result = prepare_inventory_intent(actor_from_request(request), dict(body.validated_data))
        return Response(result.body, status=result.status)

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        return Response(get_inventory_intent(actor_from_request(request), UUID(str(pk))).body)


class WriteOffViewSet(SupplyViewSet):
    queryset = InventoryIntentExecution.objects.none()
    serializer_class = WriteOffReadSerializer
    query_serializer = WriteOffQuerySerializer
    supply_actions = {
        "create": (WRITE_OFF, BAG_DISPOSE),
        "list": (WRITE_OFF, BAG_DISPOSE),
        "retrieve": (WRITE_OFF, BAG_DISPOSE),
    }

    @extend_schema(
        parameters=[WriteOffQuerySerializer], responses=WriteOffReadSerializer(many=True)
    )
    def list(self, request: Request) -> Response:
        query = self._query()
        return self._list_rows(
            write_off_rows(actor_from_request(request), query),
            lambda row: row.response["write_off"],
        )

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        kind = self._query().get("kind")
        if kind not in ("lot", "bag"):
            raise serializers.ValidationError({"kind": ["invalid_choice"]})
        return Response(get_write_off(actor_from_request(request), UUID(str(pk)), kind))

    @extend_schema(
        request=ExecuteInventoryIntentSerializer, responses={201: WriteOffOutcomeSerializer}
    )
    def create(self, request: Request) -> Response:
        body = ExecuteInventoryIntentSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        actor = actor_from_request(request)
        intent = InventoryIntent.objects.filter(
            organization=actor.organization,
            pk=body.validated_data["intent_id"],
            kind__in=("lot_write_off", "bag_disposal"),
        ).first()
        if intent is None:
            raise Http404
        return self._execute(request, (cast(IntentKind, intent.kind), None))


class TransitConfigurationViewSet(SupplyViewSet):
    serializer_class = SupplyConfigurationReadSerializer
    mapping = False
    supply_actions = {
        "list": ("supply_type.update", ALLOCATE, RECONCILE, RECEIVE_OWN, RECONCILE_OWN),
        "create": ("supply_type.update",),
    }

    @extend_schema(responses=SupplyConfigurationReadSerializer(many=True))
    def list(self, request: Request, supply_id: str) -> Response:
        from inventory.allocations.scope import authorized_center_contexts

        actor = actor_from_request(request)
        supply = SupplyType.objects.filter(organization=actor.organization, pk=supply_id).first()
        if supply is None:
            raise Http404
        if "supply_type.update" not in current_scope(actor).permissions and not any(
            authorized_center_contexts(actor, code).exists()
            for code in (ALLOCATE, RECONCILE, RECEIVE_OWN, RECONCILE_OWN)
        ):
            raise Http404
        model = SupplyMaterialMappingVersion if self.mapping else CourierTransitPolicyVersion
        return self._list_rows(
            model.objects.filter(
                organization=actor.organization, supply_version__supply_type=supply
            ).order_by("-created_at", "id"),
            lambda row: dict(SupplyConfigurationReadSerializer(row).data),
        )

    @extend_schema(
        request=TransitPolicySerializer, responses={201: SupplyConfigurationReadSerializer}
    )
    def create(self, request: Request, supply_id: str) -> Response:
        body = (
            MaterialMappingSerializer(data=request.data)
            if self.mapping
            else TransitPolicySerializer(data=request.data)
        )
        body.is_valid(raise_exception=True)
        result = publish_transit_configuration(
            ConfigurationWrite(
                actor_from_request(request),
                UUID(supply_id),
                dict(body.validated_data),
                self.mapping,
            )
        )
        return Response(SupplyConfigurationReadSerializer(result).data, status=201)


class MaterialMappingViewSet(TransitConfigurationViewSet):
    mapping = True

    @extend_schema(
        request=MaterialMappingSerializer, responses={201: SupplyConfigurationReadSerializer}
    )
    def create(self, request: Request, supply_id: str) -> Response:
        return super().create(request, supply_id)
