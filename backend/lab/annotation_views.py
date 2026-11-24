"""Paged annotation reads use the count owner's scope and numeric disclosure boundary."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from lab.annotation_serializers import EggAnnotationQuerySerializer, EggAnnotationSerializer
from lab.annotations import annotation_projection, annotation_rows
from lab.models import EggAnnotation
from lab.permissions import COUNT_READ
from lab.views import LabReadViewSet
from uploads.access import UploadActor, actor_from_request


class EggAnnotationViewSet(LabReadViewSet):
    queryset = EggAnnotation.objects.none()
    serializer_class = EggAnnotationSerializer
    query_serializer_class = EggAnnotationQuerySerializer
    required_permissions = {"list": COUNT_READ, "retrieve": COUNT_READ}
    http_method_names = ["get", "head", "options"]
    lookup_field = "public_id"

    def get_queryset(self) -> QuerySet[EggAnnotation]:
        if getattr(self, "swagger_fake_view", False):
            return EggAnnotation.objects.none()
        values = self.read_query() if self.action == "list" else {}
        return annotation_rows(actor_from_request(self.request), values)

    @extend_schema(parameters=[EggAnnotationQuerySerializer])
    def list(self, request: Request) -> Response:
        from lab.independent_qa.services import numeric_read_transaction

        actor = actor_from_request(request)
        with numeric_read_transaction(actor):
            return self.page_response(
                self.get_queryset(),
                annotation_projection,
                lambda page: self.publish_page(actor, page),
            )

    def publish_page(self, actor: UploadActor, page: Sequence[Any]) -> None:
        from lab.independent_qa.services import NumericPublication, publish_numeric_access_batch

        publish_numeric_access_batch(
            actor, [item.count for item in page], NumericPublication(COUNT_READ, "result")
        )

    def retrieve(self, request: Request, public_id: str | None = None) -> Response:
        from lab.independent_qa.services import numeric_read_transaction

        actor = actor_from_request(request)
        with numeric_read_transaction(actor):
            annotation = get_object_or_404(self.get_queryset(), public_id=public_id)
            self.publish_page(actor, [annotation])
            return Response(annotation_projection(annotation))
