"""Thin versioned resources; services own state and authorization decisions."""

from typing import Any
from uuid import UUID

from django.db.models import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import (
    OpenApiParameter,
    PolymorphicProxySerializer,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from core.exceptions import FieldValidationError
from core.filters import CodeLookupFilter
from core.table_filters import TableOrderingFilter, TableSearchFilter
from core.views import OrgScopedViewSetMixin
from inventory.access import scoped_inventory
from inventory.conditions import ConditionCapture, record_condition, record_condition_at_location
from inventory.masters import (
    MasterChange,
    deactivate_supply_type,
    revise_location,
    revise_supply_type,
)
from inventory.models import ConditionReading, LocationVersion, Lot, LotVersion, SupplyTypeVersion
from inventory.option_selectors import owner_options, placement_options, protocol_type_options
from inventory.schema import InventoryAutoSchema
from inventory.selectors import (
    condition_status,
    latest_versions,
    location_movements,
    location_stock,
    lot_versions,
)
from inventory.serializers import (
    ConditionSerializer,
    ConditionStatusQuerySerializer,
    ConditionStatusSerializer,
    ConditionWriteSerializer,
    ExplicitConditionWriteSerializer,
    InventoryRevisionSerializer,
    LocationSerializer,
    LocationWriteSerializer,
    LotPlacementOptionSerializer,
    LotSerializer,
    LotWriteSerializer,
    MovementSerializer,
    OwnerOptionQuerySerializer,
    OwnerOptionSerializer,
    PlacementOptionQuerySerializer,
    PlacementOptionSerializer,
    ProtocolTypeOptionQuerySerializer,
    ProtocolTypeOptionSerializer,
    QuadrantPlacementOptionSerializer,
    StockSerializer,
    SupplySerializer,
    SupplyWriteSerializer,
)
from inventory.services import LotChange, revise_lot
from inventory.table_filters import (
    MOVEMENT_FACETS,
    InventoryTableFilter,
    filter_movements,
    nested_order,
    nested_parameters,
    require_relation,
    validated_query,
)
from uploads.access import actor_from_request


class InventoryVersionViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset: QuerySet[Any] = SupplyTypeVersion.objects.none()
    schema = InventoryAutoSchema()
    required_permissions: dict[str, str] = {}
    option_values: dict[str, Any]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_permissions(self) -> list[Any]:
        option_queries = {
            "owner_options": OwnerOptionQuerySerializer,
            "placement_options": PlacementOptionQuerySerializer,
            "protocol_incident_type_options": ProtocolTypeOptionQuerySerializer,
        }
        if (
            not getattr(self, "swagger_fake_view", False)
            and self.action in option_queries
            and self.request.user.is_authenticated
        ):
            payload = option_queries[self.action](data=self.request.query_params.dict())
            payload.is_valid(raise_exception=True)
            self.option_values = dict(payload.validated_data)
            permission = self._option_permission()
            self.required_permissions = {**self.required_permissions, self.action: permission}
        return list(super().get_permissions())

    def _option_permission(self) -> str:
        if self.action == "owner_options":
            return "location.update" if "location" in self.option_values else "location.create"
        if self.action == "protocol_incident_type_options":
            return "supply_type.update" if "supply" in self.option_values else "supply_type.create"
        return "lot.update" if "lot" in self.option_values else str(self.option_values["action"])

    filter_backends = [
        CodeLookupFilter,
        InventoryTableFilter,
        TableSearchFilter,
        TableOrderingFilter,
    ]
    parent_field = ""
    ordering = ["code"]
    ordering_fields = ["code", "created_at"]
    inventory_facets: dict[str, str] = {}

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        actor = actor_from_request(self.request)
        permission = self.required_permissions[self.action]
        if self.queryset.model is LotVersion:
            return lot_versions(actor, permission)
        query = scoped_inventory(
            latest_versions(self.queryset.model, self.parent_field), actor, permission
        ).select_related(self.parent_field.removesuffix("_id"))
        if self.queryset.model is LocationVersion:
            return query.select_related("owner__user")
        return query.select_related("protocol__incident_type")

    def get_object(self) -> Any:  # noqa: ANN401 -- DRF's parent method returns a heterogeneous model
        try:
            identifier = UUID(self.kwargs["pk"])
        except ValueError as error:
            raise Http404 from error
        record = get_object_or_404(self.get_queryset(), **{self.parent_field: identifier})
        self.check_object_permissions(self.request, record)
        return record

    def _command(
        self,
        request: Request,
        serializer: type[serializers.Serializer[Any]],
        identifier: UUID | None = None,
    ) -> MasterChange:
        payload = serializer(data=request.data, partial=identifier is not None)
        payload.is_valid(raise_exception=True)
        values = dict(payload.validated_data)
        if identifier is not None and "expected_revision" not in values:
            raise FieldValidationError("expected_revision", "required")
        expected = values.pop("expected_revision", 0)
        return MasterChange(actor_from_request(request), values, identifier, expected)


class SupplyTypeViewSet(InventoryVersionViewSet):
    queryset = SupplyTypeVersion.objects.all()
    serializer_class = SupplySerializer
    parent_field = "supply_type_id"
    required_permissions = {
        "list": "supply_type.read",
        "retrieve": "supply_type.read",
        "create": "supply_type.create",
        "partial_update": "supply_type.update",
        "deactivate": "supply_type.deactivate",
        "protocol_incident_type_options": "supply_type.create",
    }
    code_lookup_field = "supply_type__code"
    search_fields = ["supply_type__code", "label"]
    ordering_aliases = {"code": "supply_type__code"}
    inventory_facets = {
        "is_active": "is_active",
        "is_biological": "is_biological",
        "identity_kind": "identity_kind",
    }

    @extend_schema(
        parameters=[ProtocolTypeOptionQuerySerializer],
        responses=ProtocolTypeOptionSerializer(many=True),
        filters=False,
    )
    @action(detail=False, methods=["get"], url_path="protocol-incident-type-options")
    def protocol_incident_type_options(self, request: Request) -> Response:
        query = protocol_type_options(actor_from_request(request), self.option_values)
        return self.get_paginated_response(
            ProtocolTypeOptionSerializer(self.paginate_queryset(query), many=True).data
        )

    @extend_schema(request=SupplyWriteSerializer, responses={201: SupplySerializer})
    def create(self, request: Request) -> Response:
        version = revise_supply_type(self._command(request, SupplyWriteSerializer))
        return Response(
            SupplySerializer(version, context=self.get_serializer_context()).data, status=201
        )

    @extend_schema(request=SupplyWriteSerializer, responses=SupplySerializer)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        version = revise_supply_type(
            self._command(request, SupplyWriteSerializer, current.supply_type_id)
        )
        return Response(SupplySerializer(version, context=self.get_serializer_context()).data)

    @extend_schema(request=InventoryRevisionSerializer, responses=SupplySerializer)
    @action(detail=True, methods=["post"])
    def deactivate(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        version = deactivate_supply_type(
            self._command(request, InventoryRevisionSerializer, current.supply_type_id)
        )
        return Response(SupplySerializer(version, context=self.get_serializer_context()).data)


class LocationViewSet(InventoryVersionViewSet):
    queryset = LocationVersion.objects.all()
    serializer_class = LocationSerializer
    parent_field = "location_id"
    required_permissions = {
        "list": "location.read",
        "retrieve": "location.read",
        "create": "location.create",
        "partial_update": "location.update",
        "stock": "location.read",
        "movements": "location.read",
        "owner_options": "location.create",
        "placement_options": "location.create",
    }
    code_lookup_field = "location__code"
    search_fields = ["location__code", "name"]
    ordering_aliases = {"code": "location__code"}
    inventory_facets = {
        "center": "location__center_id",
        "kind": "kind",
        "is_insecticide_free": "is_insecticide_free",
    }

    @extend_schema(
        parameters=[OwnerOptionQuerySerializer],
        responses=OwnerOptionSerializer(many=True),
        filters=False,
    )
    @action(detail=False, methods=["get"], url_path="owner-options")
    def owner_options(self, request: Request) -> Response:
        query = owner_options(actor_from_request(request), self.option_values)
        return self.get_paginated_response(
            OwnerOptionSerializer(self.paginate_queryset(query), many=True).data
        )

    @extend_schema(
        parameters=[PlacementOptionQuerySerializer],
        responses=PolymorphicProxySerializer(
            component_name="PlacementOption",
            serializers={
                "quadrant": QuadrantPlacementOptionSerializer,
                "center_only": QuadrantPlacementOptionSerializer,
                "location": LotPlacementOptionSerializer,
                "center_only_draft": LotPlacementOptionSerializer,
            },
            resource_type_field_name="kind",
            many=True,
        ),
        filters=False,
    )
    @action(detail=False, methods=["get"], url_path="placement-options")
    def placement_options(self, request: Request) -> Response:
        query = placement_options(actor_from_request(request), self.option_values)
        return self.get_paginated_response(
            PlacementOptionSerializer(self.paginate_queryset(query), many=True).data
        )

    @extend_schema(
        parameters=nested_parameters(MOVEMENT_FACETS),
        responses=MovementSerializer(many=True),
        filters=False,
    )
    @action(detail=True, methods=["get"])
    def movements(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        query = filter_movements(
            location_movements(actor_from_request(request), current.location), request
        )
        return self.get_paginated_response(
            MovementSerializer(
                self.paginate_queryset(query), many=True, context={"supply_request": request}
            ).data
        )

    @extend_schema(request=LocationWriteSerializer, responses={201: LocationSerializer})
    def create(self, request: Request) -> Response:
        version = revise_location(self._command(request, LocationWriteSerializer))
        return Response(
            LocationSerializer(version, context=self.get_serializer_context()).data, status=201
        )

    @extend_schema(request=LocationWriteSerializer, responses=LocationSerializer)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        version = revise_location(
            self._command(request, LocationWriteSerializer, current.location_id)
        )
        return Response(LocationSerializer(version, context=self.get_serializer_context()).data)

    @extend_schema(
        parameters=nested_parameters(("lot", "supply")), responses=StockSerializer(many=True)
    )
    @action(detail=True, methods=["get"])
    def stock(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        actor = actor_from_request(request)
        query = location_stock(actor, current.location)
        for name, value in validated_query(request, ("lot", "supply")).items():
            if name == "lot":
                if not location_movements(actor, current.location).filter(lot_id=value).exists():
                    raise Http404
            else:
                require_relation(actor, (name, value), "location.read")
            query = query.filter(**{"lot_id" if name == "lot" else "lot__supply_id": value})
        order = nested_order(request, ("lot__code", "piece_id"), "lot__code")[:-1]
        query = query.order_by(*order, "lot_id", "piece_id")
        page = self.paginate_queryset(query)
        return self.get_paginated_response(StockSerializer(page, many=True).data)


@extend_schema_view(
    retrieve=extend_schema(parameters=[OpenApiParameter("custody_location", OpenApiTypes.UUID)])
)
class LotViewSet(InventoryVersionViewSet):
    queryset = LotVersion.objects.all()
    serializer_class = LotSerializer
    parent_field = "lot_id"
    required_permissions = {
        "list": "lot.read",
        "retrieve": "lot.read",
        "create": "lot.create",
        "partial_update": "lot.update",
        "conditions": "lot.read",
        "condition_status": "lot.read",
        "create_condition": "condition.create",
    }
    code_lookup_field = "lot__code"
    search_fields = ["lot__code", "provenance"]
    ordering_fields = ["code", "expiry", "created_at"]
    ordering_aliases = {"code": "lot__code", "expiry": "expires_at"}
    inventory_facets = {
        "supply": "lot__supply_id",
        "location": "initial_location_id",
        "center": "lot__center_id",
        "status": "computed_status",
        "expiry_from": "expires_at__gte",
        "expiry_before": "expires_at__lt",
        "expiry_from_date": "expires_at__gte",
        "expiry_before_date": "expires_at__lt",
        "blocked_by": "blocked_by",
    }
    inventory_context_facets = ("custody_location",)

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        from inventory.transfers.custody import context_location

        actor = actor_from_request(self.request)
        location = None
        if self.action in {"list", "retrieve"} and "custody_location" in self.request.query_params:
            location = context_location(actor, self.request.query_params["custody_location"])
        self.custody_location = location
        return lot_versions(actor, self.required_permissions[self.action], location)

    def get_serializer_context(self) -> dict[str, Any]:
        return {
            **super().get_serializer_context(),
            "custody_location": getattr(self, "custody_location", None),
        }

    def get_object(self) -> Any:  # noqa: ANN401 -- DRF resource protocol
        if self.action == "retrieve":
            self._require_read_context()
        return super().get_object()

    def _require_read_context(self) -> None:
        from inventory.exceptions import InventoryConflictError
        from inventory.transfers.custody import custody_lots
        from uploads.access import current_scope

        actor = actor_from_request(self.request)
        try:
            identifier = UUID(self.kwargs["pk"])
        except ValueError as error:
            raise Http404 from error
        lot = Lot.objects.filter(organization=actor.organization, pk=identifier).first()
        if lot is None:
            raise Http404
        original = current_scope(actor).allows(
            "lot.read", str(lot.center_id), str(lot.quadrant_id) if lot.quadrant_id else None
        )
        if not original and "custody_location" not in self.request.query_params:
            permitted = (
                Lot.objects.filter(pk=lot.pk)
                .annotate(_custody=custody_lots(actor))
                .filter(_custody=True)
                .exists()
            )
            if permitted:
                raise InventoryConflictError("storage_context_required")
            raise Http404

    @extend_schema(request=LotWriteSerializer, responses={201: LotSerializer})
    def create(self, request: Request) -> Response:
        command = self._command(request, LotWriteSerializer)
        version = revise_lot(
            LotChange(command.actor, command.values, command.identifier, command.expected_revision)
        )
        return Response(
            LotSerializer(version, context=self.get_serializer_context()).data, status=201
        )

    @extend_schema(request=LotWriteSerializer, responses=LotSerializer)
    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        current = self.get_object()
        command = self._command(request, LotWriteSerializer, current.lot_id)
        version = revise_lot(
            LotChange(command.actor, command.values, command.identifier, command.expected_revision)
        )
        return Response(LotSerializer(version, context=self.get_serializer_context()).data)

    @extend_schema(
        parameters=[ConditionStatusQuerySerializer],
        responses=ConditionStatusSerializer,
        filters=False,
    )
    @action(detail=True, methods=["get"], url_path="condition-status")
    def condition_status(self, request: Request, pk: str | None = None) -> Response:
        from inventory.transfers.custody import condition_target

        query = ConditionStatusQuerySerializer(data=request.query_params.dict())
        query.is_valid(raise_exception=True)
        actor = actor_from_request(request)
        location = query.validated_data.get("location_id")
        target = condition_target(actor, (str(pk), str(location) if location else None), "lot.read")
        return Response(ConditionStatusSerializer(condition_status(actor, target)).data)

    @extend_schema(
        parameters=nested_parameters(
            ("device_time_from", "device_time_before", "local_date", "evaluation", "location_id")
        ),
        responses=ConditionSerializer(many=True),
    )
    @action(detail=True, methods=["get"])
    def conditions(self, request: Request, pk: str | None = None) -> Response:
        from django.db.models import Q

        from inventory.transfers.custody import condition_target

        lot, location = condition_target(
            actor_from_request(request),
            (str(pk), request.query_params.get("location_id")),
            "lot.read",
        )
        query = ConditionReading.objects.filter(
            organization=lot.organization, lot=lot
        ).select_related("lot", "protocol", "capture_location", "location_version__location")
        query = (
            query.filter(
                Q(capture_location=location, capture_mode="explicit_location")
                | Q(capture_mode="legacy_initial", location_version__location=location)
            )
            if location
            else query.filter(capture_mode="legacy_initial", location_version__isnull=True)
        )
        lookups = {
            "device_time_from": "device_time__gte",
            "device_time_before": "device_time__lt",
            "local_date": "local_date",
            "evaluation": "evaluation",
        }
        values = validated_query(request, tuple(lookups))
        query = query.filter(**{lookups[name]: value for name, value in values.items()}).order_by(
            *nested_order(request, ("device_time",), "-device_time")
        )
        page = self.paginate_queryset(query)
        return self.get_paginated_response(
            ConditionSerializer(page, many=True, context=self.get_serializer_context()).data
        )

    @extend_schema(
        request=PolymorphicProxySerializer(
            component_name="ConditionCaptureRequest",
            serializers=[ConditionWriteSerializer, ExplicitConditionWriteSerializer],
            resource_type_field_name=None,
        ),
        responses={201: ConditionSerializer},
    )
    @conditions.mapping.post
    def create_condition(self, request: Request, pk: str | None = None) -> Response:
        from inventory.transfers.custody import condition_target

        actor = actor_from_request(request)
        raw = request.data
        explicit = isinstance(raw, dict) and "location_id" in raw
        location = str(raw.get("location_id")) if isinstance(raw, dict) and explicit else None
        lot, _ = condition_target(actor, (str(pk), location), "condition.create")
        serializer = ExplicitConditionWriteSerializer if explicit else ConditionWriteSerializer
        payload = serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        capture = ConditionCapture(actor, lot.pk, **payload.validated_data)
        reading = record_condition_at_location(capture) if explicit else record_condition(capture)
        return Response(
            ConditionSerializer(reading, context=self.get_serializer_context()).data, status=201
        )
