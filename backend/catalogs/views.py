from typing import Any

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from catalogs.history import remember_catalog_snapshot
from catalogs.models import Catalog, CatalogItem
from catalogs.permissions import (
    CATALOG_ITEM_ACTIVATE,
    CATALOG_ITEM_CREATE,
    CATALOG_ITEM_DEACTIVATE,
    CATALOG_ITEM_UPDATE,
    CATALOG_READ,
)
from catalogs.selectors import build_catalog_snapshot, list_catalogs, with_item_usage
from catalogs.serializers import (
    CatalogItemCreateSerializer,
    CatalogItemSerializer,
    CatalogItemUpdateSerializer,
    CatalogReorderResponseSerializer,
    CatalogReorderSerializer,
    CatalogSerializer,
    CatalogSnapshotSerializer,
)
from catalogs.services import (
    CatalogItemSpec,
    activate_catalog_item,
    create_catalog_item,
    deactivate_catalog_item,
    reorder_catalog_items,
    update_catalog_item,
)
from core.snapshots import IF_NONE_MATCH_PARAMETER, snapshot_response
from core.views import OrgScopedViewSetMixin


class CatalogViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """The catalogs of the organization. They are created by the seed: there is no POST."""

    queryset = Catalog.objects.all()
    serializer_class = CatalogSerializer
    required_permissions = {"list": CATALOG_READ}

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Catalog.objects.none()
        return list_catalogs(self.request.organization)  # type: ignore[attr-defined]


class CatalogSnapshotViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """`GET /field/catalog/`: the compact copy of every catalog that phones keep offline."""

    queryset = Catalog.objects.all()
    serializer_class = CatalogSnapshotSerializer
    pagination_class = None
    required_permissions = {"list": CATALOG_READ}

    @extend_schema(
        parameters=[IF_NONE_MATCH_PARAMETER],
        responses={200: CatalogSnapshotSerializer, 304: None},
    )
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        snapshot = build_catalog_snapshot(request.organization)  # type: ignore[attr-defined]
        remember_catalog_snapshot(request.organization, request.user, snapshot)  # type: ignore[attr-defined,arg-type]
        return snapshot_response(request, snapshot)


class CatalogItemViewSet(
    OrgScopedViewSetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """Items of `/catalogs/{catalog_slug}/items/`. No PUT and no DELETE: items are deactivated."""

    queryset = CatalogItem.objects.all()
    serializer_class = CatalogItemSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    required_permissions = {
        "list": CATALOG_READ,
        "retrieve": CATALOG_READ,
        "create": CATALOG_ITEM_CREATE,
        "partial_update": CATALOG_ITEM_UPDATE,
        "deactivate": CATALOG_ITEM_DEACTIVATE,
        "activate": CATALOG_ITEM_ACTIVATE,
        "reorder": CATALOG_ITEM_UPDATE,
    }

    def get_catalog(self) -> Catalog:
        """The catalog of the URL; another organization's slug is a 404 like an unknown one."""
        if not hasattr(self, "_catalog"):
            scoped = Catalog.objects.for_org(self.request.organization)  # type: ignore[attr-defined]
            self._catalog = get_object_or_404(scoped, slug=self.kwargs["catalog_slug"])
        return self._catalog  # type: ignore[no-any-return]

    def get_queryset(self) -> QuerySet[Any]:
        catalog = self.get_catalog()
        queryset = super().get_queryset().filter(catalog=catalog)
        return with_item_usage(queryset, catalog)

    def get_serializer_class(self) -> type[serializers.BaseSerializer[Any]]:
        by_action: dict[str, type[serializers.BaseSerializer[Any]]] = {
            "create": CatalogItemCreateSerializer,
            "partial_update": CatalogItemUpdateSerializer,
            "reorder": CatalogReorderSerializer,
        }
        return by_action.get(self.action, CatalogItemSerializer)

    @extend_schema(request=CatalogItemCreateSerializer, responses={201: CatalogItemSerializer})
    def create(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = self.get_serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        spec = CatalogItemSpec(**payload.validated_data)
        item = create_catalog_item(self.get_catalog(), spec, request.user)  # type: ignore[arg-type]
        return Response(self._read(item), status=status.HTTP_201_CREATED)

    @extend_schema(request=CatalogItemUpdateSerializer, responses={200: CatalogItemSerializer})
    def partial_update(self, request: Request, *args: object, **kwargs: object) -> Response:
        item = self.get_object()
        payload = self.get_serializer(item, data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        return Response(self._read(update_catalog_item(item, payload.validated_data)))

    @extend_schema(request=None, responses={200: CatalogItemSerializer})
    @action(detail=True, methods=["post"])
    def deactivate(self, request: Request, *args: object, **kwargs: object) -> Response:
        return Response(self._read(deactivate_catalog_item(self.get_object(), request.user)))  # type: ignore[arg-type]

    @extend_schema(request=None, responses={200: CatalogItemSerializer})
    @action(detail=True, methods=["post"])
    def activate(self, request: Request, *args: object, **kwargs: object) -> Response:
        return Response(self._read(activate_catalog_item(self.get_object())))

    @extend_schema(
        request=CatalogReorderSerializer, responses={200: CatalogReorderResponseSerializer}
    )
    @action(detail=False, methods=["post"])
    def reorder(self, request: Request, *args: object, **kwargs: object) -> Response:
        payload = self.get_serializer(data=request.data)
        payload.is_valid(raise_exception=True)
        version, items = reorder_catalog_items(
            self.get_catalog(),
            **payload.validated_data,
            user=request.user,  # type: ignore[arg-type]
        )
        return Response(
            {
                "version": version,
                "items": CatalogItemSerializer(
                    items, many=True, context=self.get_serializer_context()
                ).data,
            }
        )

    def _read(self, item: CatalogItem) -> Any:  # noqa: ANN401
        return CatalogItemSerializer(item, context=self.get_serializer_context()).data
