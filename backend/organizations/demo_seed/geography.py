"""Demo quadrants, blocks and sampling points built through the geography services (writes)."""

from dataclasses import dataclass
from typing import Any

from geography.models import Block, Quadrant, SamplingPoint
from geography.services import (
    BlockCreation,
    PointCreation,
    QuadrantCreation,
    create_block,
    create_quadrant,
    create_sampling_point,
)
from organizations.models import Center, Membership

QUADRANT_SIZE = 0.006  # degrees, about 650 m
POINT_STEP = 0.0012  # about 130 m, above the 50 m same-block spacing rule


@dataclass(frozen=True)
class QuadrantPlan:
    code: str
    center_code: str
    west: float
    south: float
    blocks: int
    points_per_block: int


# Synthetic squares in an unpopulated stretch; nothing here describes a real address.
QUADRANT_PLANS = (
    QuadrantPlan("Q-DEMO-01", "C-DEMO-01", -99.140, 19.400, blocks=2, points_per_block=4),
    QuadrantPlan("Q-DEMO-02", "C-DEMO-01", -99.130, 19.400, blocks=1, points_per_block=4),
    QuadrantPlan("Q-DEMO-03", "C-DEMO-02", -99.140, 19.390, blocks=1, points_per_block=3),
)


def _rectangle(bounds: tuple[float, float, float, float]) -> dict[str, Any]:
    west, south, east, north = bounds
    ring = [[west, south], [east, south], [east, north], [west, north], [west, south]]
    return {"type": "Polygon", "coordinates": [ring]}


def _ensure_quadrant(plan: QuadrantPlan, center: Center, admin: Membership) -> Quadrant:
    existing = Quadrant.objects.filter(organization=center.organization, code=plan.code).first()
    if existing is not None:
        return existing
    geometry = _rectangle(
        (plan.west, plan.south, plan.west + QUADRANT_SIZE, plan.south + QUADRANT_SIZE)
    )
    return create_quadrant(center, QuadrantCreation(admin, plan.code, geometry))[0]


@dataclass(frozen=True)
class BlockSlot:
    """One block of a quadrant plan: its code and the rectangle it covers."""

    plan: QuadrantPlan
    index: int

    @property
    def code(self) -> str:
        return f"{self.plan.code}-B{self.index + 1}"

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        plan = self.plan
        width = QUADRANT_SIZE / plan.blocks
        west = plan.west + width * self.index
        return (
            west + 0.0002,
            plan.south + 0.0002,
            west + width - 0.0002,
            plan.south + QUADRANT_SIZE - 0.0002,
        )


def _ensure_block(quadrant: Quadrant, slot: BlockSlot, admin: Membership) -> Block:
    existing = Block.objects.filter(organization=quadrant.organization, code=slot.code).first()
    if existing is not None:
        return existing
    creation = BlockCreation(admin, slot.code, _rectangle(slot.bounds))
    return create_block(quadrant, creation)[0]


def _ensure_points(block: Block, slot: BlockSlot, admin: Membership) -> None:
    west, south, _east, _north = slot.bounds
    for number in range(slot.plan.points_per_block):
        code = f"{block.code}-P{number + 1}"
        if SamplingPoint.objects.filter(organization=block.organization, code=code).exists():
            continue
        location = [
            round(west + 0.0004 + POINT_STEP * (number % 2), 6),
            round(south + 0.0004 + POINT_STEP * (number // 2), 6),
        ]
        create_sampling_point(block, PointCreation(admin, code, location))


def ensure_geography(centers: dict[str, Center], admin: Membership) -> dict[str, Quadrant]:
    """Quadrants with blocks and points; reruns find them by code and create nothing."""
    quadrants: dict[str, Quadrant] = {}
    for plan in QUADRANT_PLANS:
        quadrant = _ensure_quadrant(plan, centers[plan.center_code], admin)
        quadrants[plan.code] = quadrant
        for index in range(plan.blocks):
            slot = BlockSlot(plan, index)
            _ensure_points(_ensure_block(quadrant, slot, admin), slot, admin)
    return quadrants
