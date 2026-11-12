"""Lab reception and egg counts of the history bags, through the real lab commands (writes).

Older weeks are fully counted; the latest week is partly received, so the entomologist still has
bags to receive and count in the demo. Command ids come from the bag code, so reruns replay.
"""

import random
from uuid import uuid5

from lab.access import LabTarget
from lab.commands import LabCommandInput, execute_lab_command
from lab.models import BagReceipt, EggCountAttempt
from organizations.demo_seed.field import NAMESPACE
from organizations.demo_seed.history import (
    MEAN_EGGS_BY_WEEK,
    SEED,
    ZONE_FACTOR,
    hotspot_factor,
)
from organizations.demo_seed.resilience import retrying
from organizations.models import Organization
from ovitraps.models import Bag
from uploads.access import UploadActor

HISTORY_BAG_PREFIX = "B-20"  # history codes look like B-2026W45-0001; phone bags are B-MER-NNN
PENDING_COUNTS = 6  # received in the latest week but not counted: the count queue has work
BAGS_PER_WEEK = 18  # each lab command takes seconds; this keeps the seed to a few minutes


def _egg_value(bag: Bag, weeks_ago: int) -> int:
    rng = random.Random(f"{SEED}:count:{bag.code}")  # noqa: S311 -- synthetic data
    if not bag.reading.has_eggs:
        return 0
    point = bag.reading.ovitrap.sampling_point
    mean = (
        MEAN_EGGS_BY_WEEK[weeks_ago]
        * ZONE_FACTOR[point.block.quadrant.code]
        * hotspot_factor(point.code)
    )
    return max(3, min(420, int(rng.gauss(mean, mean * 0.35))))


def _command_id(kind: str, bag: Bag):  # noqa: ANN202
    return uuid5(NAMESPACE, f"lab:{kind}:{bag.code}")


def ensure_lab_history(organization: Organization, entomologist: UploadActor) -> int:
    """Receive and count the history bags; returns how many bags were counted now."""
    bags = list(
        Bag.objects.filter(organization=organization, code__startswith=HISTORY_BAG_PREFIX)
        .select_related("reading__ovitrap__sampling_point__block__quadrant")
        .order_by("reading__epi_week", "code")
    )
    # Spread the counted bags over quadrants instead of taking the first codes of each week.
    bags.sort(key=lambda bag: (bag.reading.epi_week, uuid5(NAMESPACE, bag.code).hex))
    weeks = sorted({bag.reading.epi_week for bag in bags})
    counted_bags = set(
        EggCountAttempt.objects.filter(organization=organization).values_list("bag_id", flat=True)
    )
    counted = 0
    received_bags = set(
        BagReceipt.objects.filter(organization=organization).values_list("bag_id", flat=True)
    )
    per_week: dict[str, int] = {}
    for bag in bags:  # bags received in an earlier run use up the weekly share
        if bag.pk in received_bags:
            per_week[bag.reading.epi_week] = per_week.get(bag.reading.epi_week, 0) + 1
    for bag in bags:
        weeks_ago = len(weeks) - weeks.index(bag.reading.epi_week)
        if bag.pk in counted_bags or (bag.pk in received_bags and weeks_ago == 1):
            continue
        taken = per_week.get(bag.reading.epi_week, 0)
        if taken >= BAGS_PER_WEEK:
            continue
        per_week[bag.reading.epi_week] = taken + 1
        target = LabTarget("bag", bag.pk)
        # The command ids are fixed per bag: a bag received by an interrupted run replays its
        # reception and only the missing count is written.
        receive = LabCommandInput("receive", target, _command_id("receive", bag), {})
        retrying(lambda receive=receive: execute_lab_command(entomologist, receive))
        if weeks_ago == 1 and taken >= BAGS_PER_WEEK - PENDING_COUNTS:
            continue
        values = {
            "expected_revision": 0,
            "value": _egg_value(bag, weeks_ago),
            "confirmed_implausible": False,
        }
        count = LabCommandInput("count", target, _command_id("count", bag), values)
        retrying(lambda count=count: execute_lab_command(entomologist, count))
        counted += 1
    return counted
