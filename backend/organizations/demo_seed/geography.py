"""Demo quadrants, blocks and sampling points built through the geography services (writes)."""

from dataclasses import dataclass
from typing import Any

from geography.models import Block, Quadrant, ReleasePoint, SamplingPoint
from geography.release_points import ReleasePointCreation, create_release_point
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
    colonia: str
    west: float
    south: float
    blocks: int
    points_per_block: int
    street_base: int  # first E-W street number ("Calle N") of the grid
    cross_base: int  # first N-S cross street number of the grid


# Squares over real Mérida colonias. Coordinates are approximate and synthetic (not survey data);
# the street numbers follow the city's numbered-street grid but name no real address or person.
QUADRANT_PLANS = (
    QuadrantPlan("Q-MER-01", "C-DEMO-01", "Centro", -89.5955, 20.9644, 2, 8, 56, 57),
    QuadrantPlan("Q-MER-02", "C-DEMO-01", "Santiago", -89.5875, 20.9644, 2, 8, 66, 63),
    QuadrantPlan("Q-MER-03", "C-DEMO-02", "García Ginerés", -89.6335, 20.9830, 2, 8, 20, 33),
    QuadrantPlan("Q-MER-04", "C-DEMO-01", "Pensiones", -89.6110, 20.9540, 2, 8, 59, 112),
    QuadrantPlan("Q-MER-05", "C-DEMO-01", "Itzimná", -89.6030, 20.9990, 2, 8, 12, 25),
    QuadrantPlan("Q-MER-06", "C-DEMO-02", "Chuburná", -89.6270, 21.0130, 2, 8, 17, 8),
    QuadrantPlan("Q-MER-07", "C-DEMO-02", "Francisco de Montejo", -89.6600, 21.0330, 2, 6, 4, 4),
    QuadrantPlan("Q-MER-08", "C-DEMO-01", "Montes de Amé", -89.6150, 21.0020, 2, 6, 30, 15),
)
PLAN_BY_CODE = {plan.code: plan for plan in QUADRANT_PLANS}


def point_address(point_code: str) -> str:
    """Street address of a seeded point (a local note; the model has no address field)."""
    parts = point_code.split("-")  # Q-MER-01-B1-P3
    plan = PLAN_BY_CODE["-".join(parts[:3])]
    block_index = int(parts[3][1:]) - 1
    index = int(parts[4][1:]) - 1
    street = plan.street_base + 2 * (index // 2)
    cross = plan.cross_base + 2 * (block_index * 2 + index % 2)
    return f"Calle {street} x {cross} y {cross + 2}, Col. {plan.colonia}, Mérida, Yuc."


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


def ensure_release_points(quadrants: dict[str, Quadrant], admin: Membership) -> None:
    """One planned release point per quadrant, on the street between its blocks (writes)."""
    for plan in QUADRANT_PLANS:
        code = f"RP-{plan.code}"
        if ReleasePoint.objects.filter(organization=admin.organization, code=code).exists():
            continue
        location = [
            round(plan.west + QUADRANT_SIZE / 2, 6),
            round(plan.south + QUADRANT_SIZE / 2, 6),
        ]
        create_release_point(quadrants[plan.code], ReleasePointCreation(admin, code, location))
