"""Closed B10 commands retain exact authored input and explicit execution identity."""

from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from inventory.allocations.permissions import INTENT_KINDS  # noqa: F401 -- closed wire export
from uploads.access import UploadActor

IntentKind = Literal[
    "assignment_release",
    "release_cancel",
    "return_accept",
    "reconcile_justify",
    "lot_write_off",
    "bag_disposal",
]


@dataclass(frozen=True)
class AssignmentWrite:
    actor: UploadActor
    values: dict[str, Any]
    assignment_id: UUID | None = None


@dataclass(frozen=True)
class ConfigurationWrite:
    actor: UploadActor
    supply_id: UUID
    values: dict[str, Any]
    mapping: bool = False


@dataclass(frozen=True)
class IntentExecution:
    intent_id: UUID
    kind: IntentKind
    target_id: UUID | None = None


@dataclass(frozen=True)
class SupplyOutcome:
    status: int
    body: dict[str, Any]
    replayed: bool = False
