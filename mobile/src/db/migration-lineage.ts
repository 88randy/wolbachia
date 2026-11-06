import type { SqlExecutor } from "./sql.ts";

const UNMERGED_DRAFT_VERSIONS = new Set([9, 10, 11]);
class UnmergedLifecycleDraftError extends Error {
  constructor() {
    super(
      "Unmerged lifecycle draft database has a conflicting migration lineage; retain its data for an explicit migration.",
    );
    this.name = "UnmergedLifecycleDraftError";
  }
}

/** Refuse demonstrated draft numbering before any migration write; never reset retained QA data. */
export async function assertCanonicalMigrationLineage(
  db: SqlExecutor,
  version: number,
): Promise<void> {
  if (!UNMERGED_DRAFT_VERSIONS.has(version)) return;
  const tables = await db.query(`SELECT name FROM sqlite_master WHERE type='table'
    AND name IN ('day_sampling_point','lifecycle_capture','lifecycle_draft')`);
  const hasCanonicalPoints = tables.some((row) => row.name === "day_sampling_point");
  const hasLifecycle = tables.some(
    (row) => row.name === "lifecycle_capture" || row.name === "lifecycle_draft",
  );
  if (hasLifecycle && !hasCanonicalPoints) throw new UnmergedLifecycleDraftError();
}
