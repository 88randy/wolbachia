"""Existing Bag/Reading facade commands; authorize the actual target before payload state."""

from typing import Any
from uuid import UUID

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from lab.access import LabTarget, prepare_lab_subject, scoped_bags
from lab.commands import ACTION_PERMISSION, LabCommandInput, execute_lab_command
from lab.permissions import BAG_RECEIVE
from lab.serializers import (
    CountWriteSerializer,
    LabCommandSerializer,
    LabCountOutcomeSerializer,
    LabReceptionConflictSerializer,
    LabReceptionOutcomeSerializer,
    LabRejectionOutcomeSerializer,
    MissingBagSerializer,
    ReceiveBagSerializer,
    RejectionWriteSerializer,
)
from uploads.access import actor_from_request


def run_command(
    request: Request, target: LabTarget, command: tuple[str, type[serializers.Serializer[Any]]]
) -> Response:
    operation, owner = command
    actor = actor_from_request(request)
    prepare_lab_subject(actor, target, ACTION_PERMISSION[operation])
    payload = owner(data=request.data)
    payload.is_valid(raise_exception=True)
    values = dict(payload.validated_data)
    command_id = values.pop("command_id")
    outcome = execute_lab_command(actor, LabCommandInput(operation, target, command_id, values))
    return Response(outcome.body, status=outcome.status)


class BagLabActions:
    @extend_schema(
        request=ReceiveBagSerializer,
        responses={200: LabReceptionOutcomeSerializer, 409: LabReceptionConflictSerializer},
    )
    @action(detail=False, methods=["post"])
    def receive(self, request: Request) -> Response:
        payload = ReceiveBagSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        bag = get_object_or_404(
            scoped_bags(actor_from_request(request), BAG_RECEIVE),
            code=payload.validated_data["code"],
        )
        return run_command(request, LabTarget("bag", bag.pk), ("receive", ReceiveBagSerializer))

    @extend_schema(request=MissingBagSerializer, responses={409: LabReceptionConflictSerializer})
    @action(detail=True, methods=["post"], url_path="mark-missing")
    def mark_missing(self, request: Request, pk: str | None = None) -> Response:
        return run_command(
            request, LabTarget("bag", UUID(str(pk))), ("missing", MissingBagSerializer)
        )

    @extend_schema(request=CountWriteSerializer, responses={201: LabCountOutcomeSerializer})
    @action(detail=True, methods=["post"])
    def counts(self, request: Request, pk: str | None = None) -> Response:
        return run_command(
            request, LabTarget("bag", UUID(str(pk))), ("count", CountWriteSerializer)
        )

    @extend_schema(request=RejectionWriteSerializer, responses={201: LabRejectionOutcomeSerializer})
    @action(detail=True, methods=["post"])
    def rejections(self, request: Request, pk: str | None = None) -> Response:
        return run_command(
            request, LabTarget("bag", UUID(str(pk))), ("reject", RejectionWriteSerializer)
        )


class ReadingLabActions:
    @extend_schema(
        request=LabCommandSerializer,
        responses={200: LabReceptionOutcomeSerializer, 409: LabReceptionConflictSerializer},
    )
    @action(detail=True, methods=["post"])
    def receive(self, request: Request, pk: str | None = None) -> Response:
        return run_command(
            request, LabTarget("reading", UUID(str(pk))), ("receive_reading", LabCommandSerializer)
        )
