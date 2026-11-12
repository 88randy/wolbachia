"""`GET /lookups/users/`: display names of staff for pickers and "who did it".

A narrow read (`user.lookup`) for profiles that only need a person's name (lab collector,
scheduling courier, dashboard filters). It never serves contact data, RFC metadata, devices,
trainings or profiles; `is_courier` only tells a courier picker which names to offer. The broad
personnel codes (`user.operational_read`, `user.read`) also unlock it.
"""

from typing import Any

from django.db.models import Exists, OuterRef, Q, QuerySet
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, serializers, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated

from accounts.models import Personnel
from accounts.permissions import USER_LOOKUP, USER_OPERATIONAL_READ, USER_READ
from core.pagination import StandardPagination
from core.permissions import HasAnyPermissionCode
from core.views import OrgScopedViewSetMixin
from organizations.models import Profile
from organizations.services import effective_scope

LOOKUP_CODES = (USER_LOOKUP, USER_OPERATIONAL_READ, USER_READ)
COURIER_PROFILE = "courier"


class UserLookupSerializer(serializers.Serializer[Any]):
    id = serializers.UUIDField(source="membership.user_id")
    display_name = serializers.CharField()
    is_courier = serializers.BooleanField()


class UserLookupQuerySerializer(serializers.Serializer[Any]):
    center = serializers.UUIDField(required=False)
    # Omitted means active only: a picker never offers a deactivated person.
    include_inactive = serializers.BooleanField(required=False, default=False)


@extend_schema_view(list=extend_schema(parameters=[UserLookupQuerySerializer]))
class UserLookupViewSet(
    OrgScopedViewSetMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = Personnel.objects.all()
    serializer_class = UserLookupSerializer
    permission_classes = [IsAuthenticated, HasAnyPermissionCode]
    required_any_permissions = {"list": LOOKUP_CODES, "retrieve": LOOKUP_CODES}
    lookup_field = "membership__user_id"
    lookup_url_kwarg = "pk"
    pagination_class = StandardPagination
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["display_name"]
    ordering_fields = ["display_name"]
    ordering = ["display_name", "id"]

    def get_queryset(self) -> QuerySet[Any]:
        if getattr(self, "swagger_fake_view", False):
            return Personnel.objects.none()
        from people.selectors import scoped_facts

        membership = self.request.membership  # type: ignore[attr-defined]
        scope = effective_scope(membership)
        base = Personnel.objects.filter(organization_id=membership.organization_id)
        allowed = Q(pk__in=[])
        for code in LOOKUP_CODES:
            allowed |= Q(pk__in=scoped_facts(base, scope, code).values("pk"))
        couriers = Profile.objects.filter(
            memberships=OuterRef("membership_id"), slug=COURIER_PROFILE, is_active=True
        )
        rows = (
            base.filter(allowed).select_related("membership").annotate(is_courier=Exists(couriers))
        )
        if self.action == "list":
            query = UserLookupQuerySerializer(data=self.request.query_params.dict())
            query.is_valid(raise_exception=True)
            if "center" in query.validated_data:
                rows = rows.filter(center_id=query.validated_data["center"])
            if not query.validated_data["include_inactive"]:
                rows = rows.filter(membership__is_active=True)
        return rows
