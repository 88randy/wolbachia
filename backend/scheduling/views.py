"""Thin session/CSRF and pinned-bearer API, with default-deny action maps."""

from typing import Any, cast

from django.db.models import QuerySet
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response

from core.exceptions import FieldValidationError
from core.pagination import StandardPagination
from core.views import OrgScopedViewSetMixin
from organizations.models import Membership
from scheduling import selectors, serializers, services
from scheduling.csv_import import MAX_UPLOAD_BYTES
from scheduling.models import RiskCategoryVersion, RiskImport, ScheduledTask
from scheduling.permissions import RISK_IMPORT_APPLY, SCHEDULE_MANAGE, SCHEDULE_READ
from scheduling.uploads import BoundedRiskUploadHandler, RiskUploadThrottle


def _membership(request: Request) -> Membership:
    return cast(Membership, request.__dict__["membership"])


class UploadViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    serializer_class = serializers.UploadRequestSerializer
    required_permissions = {"create": RISK_IMPORT_APPLY}
    parser_classes = [MultiPartParser]
    throttle_classes = [RiskUploadThrottle]
    http_method_names = ["post", "options"]

    def initialize_request(self, request: Any, *args: Any, **kwargs: Any) -> Request:  # noqa: ANN401
        request.upload_handlers.insert(0, BoundedRiskUploadHandler(request))
        return super().initialize_request(request, *args, **kwargs)

    @extend_schema(
        request=serializers.UploadRequestSerializer,
        responses={201: serializers.UploadResponseSerializer},
    )
    def create(self, request: Request) -> Response:
        payload = request.data
        if getattr(request._request, "risk_upload_too_large", False):
            raise FieldValidationError("file", "file_too_large")
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["file"]
        if upload.size > MAX_UPLOAD_BYTES:
            raise FieldValidationError("file", "file_too_large")
        stored = services.store_upload(
            _membership(request), upload.name, upload.read(MAX_UPLOAD_BYTES + 1)
        )
        return Response(
            {"upload_id": str(stored.pk), "sha256": stored.sha256, "size": stored.size}, status=201
        )


class ImportViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    lookup_value_regex = (
        "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    )
    queryset = RiskImport.objects.all()
    serializer_class = serializers.ImportSerializer
    required_permissions = {"create": RISK_IMPORT_APPLY, "apply": RISK_IMPORT_APPLY}
    http_method_names = ["post", "options"]

    @extend_schema(
        request=serializers.PreviewRequestSerializer, responses={201: serializers.ImportSerializer}
    )
    def create(self, request: Request) -> Response:
        payload = serializers.PreviewRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        preview = services.preview_import(
            _membership(request), services.ImportPreview(**payload.validated_data)
        )
        return Response(self.get_serializer(preview).data, status=201)

    @extend_schema(
        request=serializers.RevisionSerializer, responses=serializers.ApplicationSerializer
    )
    @action(detail=True, methods=["post"])
    def apply(self, request: Request, pk: str | None = None) -> Response:
        payload = serializers.RevisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        instance = self.get_object()
        application = services.apply_import(
            _membership(request), instance.pk, **payload.validated_data
        )
        return Response(serializers.ApplicationSerializer(application).data)


class RiskCategoryViewSet(OrgScopedViewSetMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = RiskCategoryVersion.objects.all()
    serializer_class = serializers.RiskSerializer
    required_permissions = {"list": SCHEDULE_READ}
    pagination_class = StandardPagination
    filter_backends = [OrderingFilter]
    ordering_fields = ["block__code", "category", "created_at"]
    ordering = ["block__code", "id"]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self) -> QuerySet[RiskCategoryVersion]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        payload = serializers.RiskQuerySerializer(data=self.request.query_params)
        payload.is_valid(raise_exception=True)
        query = payload.validated_data
        member = _membership(self.request)
        selectors.validate_filters(member, query, SCHEDULE_READ)
        risks = selectors.current_risks(
            member, selectors.week_start(member.organization, query["week"])
        )
        for key, path in {
            "block": "block_id",
            "quadrant": "block__quadrant_id",
            "code": "block__code",
        }.items():
            if query.get(key) is not None:
                risks = risks.filter(**{path: query[key]})
        return risks

    @extend_schema(parameters=[serializers.RiskQuerySerializer])
    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:  # noqa: ANN401
        return super().list(request, *args, **kwargs)


class AssignmentViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    serializer_class = serializers.AssignmentSerializer
    required_permissions = {"list": SCHEDULE_READ, "update": SCHEDULE_MANAGE}
    pagination_class = StandardPagination
    http_method_names = ["get", "put", "head", "options"]

    @extend_schema(
        parameters=[serializers.AssignmentQuerySerializer],
        responses=serializers.AssignmentSerializer(many=True),
    )
    def list(self, request: Request) -> Response:
        query = serializers.AssignmentQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        rows = selectors.assignment_rows(_membership(request), query.validated_data)
        ordering = query.validated_data.get("ordering", "code")
        rows.sort(
            key=lambda row: (row[ordering.lstrip("-")], row["quadrant"]),
            reverse=ordering.startswith("-"),
        )
        page = self.paginate_queryset(rows)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(
        request=serializers.AssignmentRequestSerializer,
        responses=serializers.AssignmentResultSerializer,
    )
    def update(self, request: Request) -> Response:
        payload = serializers.AssignmentRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = services.change_assignment(
            _membership(request), services.AssignmentChange(**payload.validated_data)
        )
        return Response(serializers.AssignmentResultSerializer(result).data)


class ScheduleViewSet(OrgScopedViewSetMixin, viewsets.GenericViewSet):
    queryset = ScheduledTask.objects.none()
    serializer_class = serializers.TaskSerializer
    required_permissions = {
        "list": SCHEDULE_READ,
        "generate": SCHEDULE_MANAGE,
        "reassign_pending": SCHEDULE_MANAGE,
    }
    pagination_class = StandardPagination
    http_method_names = ["get", "post", "head", "options"]

    @extend_schema(
        parameters=[serializers.ScheduleQuerySerializer],
        responses=serializers.SchedulePageSerializer,
    )
    def list(self, request: Request) -> Response:
        query = serializers.ScheduleQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        member = _membership(request)
        # A consistent revision and task snapshot, even if a writer commits during pagination.
        with services.planning_lock(member, SCHEDULE_READ) as member:
            revision = selectors.schedule_revision(member.organization)
            tasks = selectors.filtered_tasks(member, query.validated_data)
            loads = selectors.task_loads(tasks)
            page = self.paginate_queryset(tasks)
            rows = selectors.task_rows(page or [], loads)
            response = self.get_paginated_response(self.get_serializer(rows, many=True).data)
            response.data.update(
                revision=revision,
                load=[{"courier": key, "load": value} for key, value in loads.items()],
                target=selectors.daily_target(
                    member.organization,
                    query.validated_data.get(
                        "day",
                        selectors.week_start(member.organization, query.validated_data["week"]),
                    ),
                ),
            )
            return response

    @extend_schema(
        request=serializers.WeekQuerySerializer, responses=serializers.GenerateResultSerializer
    )
    @action(detail=False, methods=["post"])
    def generate(self, request: Request) -> Response:
        payload = serializers.WeekQuerySerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        return Response(
            services.generate_schedule(_membership(request), payload.validated_data["week"])
        )

    @extend_schema(
        request=serializers.ReassignRequestSerializer,
        responses=serializers.ReassignResultSerializer,
    )
    @action(detail=False, methods=["post"], url_path="reassign-pending")
    def reassign_pending(self, request: Request) -> Response:
        payload = serializers.ReassignRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        result = services.reassign_pending(
            _membership(request),
            services.PendingReassignment(
                task_ids=tuple(payload.validated_data["task_ids"]),
                courier=payload.validated_data["courier"],
                expected_revision=payload.validated_data["expected_revision"],
            ),
        )
        return Response(serializers.ReassignResultSerializer(result).data)
