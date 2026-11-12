"""Ovitrap labels: mint a batch (web, W19) and the pool of unplaced labels (phone download)."""

from typing import Any

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from core.views import OrgScopedViewSetMixin
from field_sync.permissions import FIELD_BOOTSTRAP
from ovitraps.labels import MAX_MINT, MAX_POOL, mint_labels, unplaced_labels
from ovitraps.models import OvitrapLabel
from ovitraps.permissions import OVITRAP_READ


class OvitrapLabelSerializer(serializers.ModelSerializer[OvitrapLabel]):
    """`id` is the QR identity: the sticker carries `wbf:1:ovitrap:<id>`."""

    id = serializers.UUIDField(source="client_uuid", read_only=True)

    class Meta:
        model = OvitrapLabel
        fields = ["id", "code", "created_at"]
        read_only_fields = fields


class OvitrapLabelMintSerializer(serializers.Serializer[Any]):
    count = serializers.IntegerField(min_value=1, max_value=MAX_MINT)


class OvitrapLabelPoolSerializer(serializers.Serializer[Any]):
    labels = OvitrapLabelSerializer(many=True)


class OvitrapLabelViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """`POST /ovitrap-labels/`: register `count` new stickers (uuid + `OVT-0001` code)."""

    queryset = OvitrapLabel.objects.all()
    serializer_class = OvitrapLabelMintSerializer
    pagination_class = None
    http_method_names = ["post", "options"]
    required_permissions = {"create": OVITRAP_READ}

    @extend_schema(request=OvitrapLabelMintSerializer, responses={201: OvitrapLabelPoolSerializer})
    def create(self, request: Request) -> Response:
        body = OvitrapLabelMintSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        labels = mint_labels(
            request.organization,  # type: ignore[attr-defined]
            request.user,  # type: ignore[arg-type]
            body.validated_data["count"],
        )
        return Response(OvitrapLabelPoolSerializer({"labels": labels}).data, status=201)


class FieldOvitrapLabelViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    """`GET /field/ovitrap-labels/`: unplaced labels a phone keeps to resolve a typed code offline."""

    queryset = OvitrapLabel.objects.all()
    serializer_class = OvitrapLabelPoolSerializer
    pagination_class = None
    required_permissions = {"list": FIELD_BOOTSTRAP}

    def get_queryset(self) -> QuerySet[OvitrapLabel]:
        if getattr(self, "swagger_fake_view", False):
            return OvitrapLabel.objects.none()
        return unplaced_labels(self.request.organization)  # type: ignore[attr-defined]

    @extend_schema(responses=OvitrapLabelPoolSerializer)
    def list(self, request: Request, *args: object, **kwargs: object) -> Response:
        labels = list(self.get_queryset()[:MAX_POOL])
        return Response(OvitrapLabelPoolSerializer({"labels": labels}).data)
