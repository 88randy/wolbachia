"""Short human codes (`LIB-0042`, `JOR-0128`): sequential per organization and kind.

The counter row is the arbiter. It is locked with `FOR UPDATE NOWAIT` and held until the caller's
transaction ends, so the number is gapless (a rolled back savepoint gives it back) and two
writers can never share one. A busy counter raises `OperationalError` (SQLSTATE 55P03), which the
sync pipeline already answers as `429 sync_in_progress`; this is a leaf lock, taken after every
other lock of the writer, so it cannot join a lock cycle.
"""

from dataclasses import dataclass

from django.db import IntegrityError, transaction

from organizations.models import CodeCounter, Organization

CODE_WIDTH = 4


@dataclass(frozen=True)
class CodeKind:
    """A family of codes: the counter `kind` and the printed `prefix` (`LIB`)."""

    kind: str
    prefix: str


RELEASE_CODE = CodeKind("release", "LIB")
SHIFT_CODE = CodeKind("shift", "JOR")


def format_code(prefix: str, number: int) -> str:
    return f"{prefix}-{number:0{CODE_WIDTH}d}"


def allocate_code(organization: Organization, code_kind: CodeKind) -> str:
    """The next code of `kind` for `organization`. Call it inside the writer's transaction, only
    after the checks that may reject the write, so a replay or rejection consumes no number."""
    counter = _locked_counter(organization, code_kind.kind)
    counter.last_number += 1
    counter.save(update_fields=["last_number"])
    return format_code(code_kind.prefix, counter.last_number)


def allocate_codes(organization: Organization, code_kind: CodeKind, count: int) -> list[str]:
    """`count` consecutive codes in one counter update, for a bulk insert (the demo seed)."""
    counter = _locked_counter(organization, code_kind.kind)
    first = counter.last_number + 1
    counter.last_number += count
    counter.save(update_fields=["last_number"])
    return [format_code(code_kind.prefix, number) for number in range(first, first + count)]


def _locked_counter(organization: Organization, kind: str) -> CodeCounter:
    query = CodeCounter.objects.filter(organization=organization, kind=kind)
    counter = query.select_for_update(nowait=True).first()
    if counter is not None:
        return counter
    try:
        with transaction.atomic():
            CodeCounter.objects.create(organization=organization, kind=kind)
    except IntegrityError:
        # A concurrent writer created it first; the lock below decides who goes next.
        pass
    return query.select_for_update(nowait=True).get()
