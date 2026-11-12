"""Backfill of short human codes for rows that existed before the code column (data migrations).

Plain SQL on purpose: the records are insert-only, so each migration disables its own guard
trigger only around this update, inside the migration transaction, and writes only `code`.
"""

from dataclasses import dataclass
from typing import Any

from organizations.codes import CodeKind


@dataclass(frozen=True)
class BackfillTarget:
    """The table to number, its insert-only guard trigger and the kind of code it gets."""

    table: str
    guard: str
    code_kind: CodeKind


def backfill_codes(schema_editor: Any, target: BackfillTarget) -> None:  # noqa: ANN401 -- Django schema editor
    """Number the rows of each organization by creation time, then seed the organization counters
    so the next live allocation continues after the last backfilled number."""
    table, guard = target.table, target.guard
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f"ALTER TABLE {table} DISABLE TRIGGER {guard}")
        cursor.execute(
            f"""
            UPDATE {table} AS target
            SET code = %s || '-' || lpad(numbered.position::text, 4, '0')
            FROM (
                SELECT id, row_number() OVER (
                    PARTITION BY organization_id ORDER BY created_at, id
                ) AS position
                FROM {table}
            ) AS numbered
            WHERE target.id = numbered.id AND target.code = ''
            """,  # noqa: S608 -- the table is a constant of the migration, never input
            [target.code_kind.prefix],
        )
        cursor.execute(f"ALTER TABLE {table} ENABLE TRIGGER {guard}")
        cursor.execute(
            f"""
            INSERT INTO organizations_codecounter
                (id, organization_id, created_at, kind, last_number)
            SELECT gen_random_uuid(), organization_id, now(), %s, count(*)
            FROM {table}
            GROUP BY organization_id
            ON CONFLICT (organization_id, kind)
            DO UPDATE SET last_number = GREATEST(
                organizations_codecounter.last_number, EXCLUDED.last_number
            )
            """,  # noqa: S608 -- the table is a constant of the migration, never input
            [target.code_kind.kind],
        )
