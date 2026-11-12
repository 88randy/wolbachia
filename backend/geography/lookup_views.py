"""`GET /lookups/quadrants/`: quadrant codes and outlines for pickers and names.

A narrow read (`quadrant.lookup`) for profiles that only need to name or pick a quadrant (lab,
scheduling, dashboards, permits). It never serves blocks, sampling points, excluded points,
authors or version history: those stay behind `quadrant.read`, which also unlocks this lookup.
"""

from typing import Any

from django.db.models import Prefetch, Q, QuerySet
from drf_spectacular.utils import extend_schema, extend_schema_field, extend_schema_view
from rest_framework import mixins, serializers, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated

from core.pagination import StandardPagination
from core.permissions import HasAnyPermissionCode
from core.serializers import OrgScopedModelSerializer
from core.views import OrgScopedViewSetMixin
from geography.models import Quadrant, QuadrantVersion
from geography.permissions import QUADRANT_LOOKUP, QUADRANT_READ
from geography.serializers import PolygonField
from organizations.models import Membership
from organizations.selectors import filter_by_effective_scope

LOOKUP_CODES = (QUADRANT_LOOKUP, QUADRANT_READ)


def union_scoped(
    rows: QuerySet[Any], membership: Membership, codes: tuple[str, ...]
) -> QuerySet[Any]:
    """The rows any of `codes` reaches, each code with its own paired grants."""
    allowed = Q(pk__in=[])
    for code in codes:
        allowed |= Q(pk__in=filter_by_effective_scope(rows, membership, code).values("pk"))
    return rows.filter(allowed)


class QuadrantOutlineSerializer(serializers.Serializer[Any]):
    geometry = PolygonField(read_only=True)


class QuadrantLookupSerializer(OrgScopedModelSerializer):
    current_version = serializers.SerializerMethodField()

    @extend_schema_field(QuadrantOutlineSerializer(allow_null=True))
    def get_current_version(self, quadrant: Quadrant) -> dict[str, Any] | None:
        versions = list(quadrant.versions.all())
        return dict(QuadrantOutlineSerializer(versions[0]).data) if versions else None

    class Meta:
        model = Quadrant
        fields = ["id", "code", "center", "current_version"]
        read_only_fields = fields


class QuadrantLookupQuerySerializer(serializers.Serializer[Any]):
    center = serializers.UUIDField(required=False)


@extend_schema_view(list=extend_schema(parameters=[QuadrantLookupQuerySerializer]))
class QuadrantLookupViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = Quadrant.objects.all()
    serializer_class = QuadrantLookupSerializer
    permission_classes = [IsAuthenticated, HasAnyPermissionCode]
    required_any_permissions = {"list": LOOKUP_CODES, "retrieve": LOOKUP_CODES}
    pagination_class = StandardPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["code"]
    ordering_fields = ["code"]
    ordering = ["code", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Quadrant.objects.none()
        rows = union_scoped(
            super().get_queryset(),
            self.request.membership,  # type: ignore[attr-defined]
            LOOKUP_CODES,
        ).prefetch_related(
            Prefetch("versions", queryset=QuadrantVersion.objects.order_by("-revision"))
        )
        if self.action == "list":
            query = QuadrantLookupQuerySerializer(data=self.request.query_params)
            query.is_valid(raise_exception=True)
            if "center" in query.validated_data:
                rows = rows.filter(center_id=query.validated_data["center"])
        return rows
