import {
  isRecord,
  isQuadrantAssignment,
  parseAssignment,
  parseManifest,
} from "./assignment-parser.ts";
import type { AssignedTask, BundleMeta, MapManifest } from "./types.ts";
export interface ParsedBundle {
  readonly tasks: readonly AssignedTask[];
  readonly manifests: readonly MapManifest[];
  readonly meta: BundleMeta;
  readonly cursor: string;
}
interface RawBundle {
  readonly bundle_version: string;
  readonly schema_version: string;
  readonly scope_revision: string;
  readonly cursor: string;
  readonly next_change_at: string | null;
  readonly map_manifest_ready: boolean;
  readonly assignments: readonly unknown[];
  readonly map_manifests: readonly unknown[];
}
function validateBundle(body: unknown): asserts body is RawBundle {
  if (!isRecord(body)) throw new Error("Malformed day bundle.");
  if (
    !["bundle_version", "schema_version", "scope_revision", "cursor"].every(
      (key) => typeof body[key] === "string" && body[key],
    )
  )
    throw new Error("Missing bundle metadata.");
  if (
    !Array.isArray(body.assignments) ||
    !Array.isArray(body.map_manifests) ||
    typeof body.map_manifest_ready !== "boolean"
  )
    throw new Error("Missing bundle sections.");
  if (
    body.next_change_at !== null &&
    (typeof body.next_change_at !== "string" || !Number.isFinite(Date.parse(body.next_change_at)))
  )
    throw new Error("Invalid due date.");
}
/** Bootstrap is an object at runtime despite the generated array response annotation. */
export function parseBundle(body: unknown, now: Date): ParsedBundle {
  validateBundle(body);
  const assignments = body.assignments.filter((row) => !isQuadrantAssignment(row));
  const tasks = assignments.map(parseAssignment).filter((row): row is AssignedTask => row !== null);
  const manifests = body.map_manifests.map((entry) => {
    const manifest = parseManifest(entry);
    if (manifest === null) throw new Error("Malformed bootstrap map manifest.");
    return manifest;
  });
  return {
    tasks,
    manifests,
    cursor: body.cursor,
    meta: {
      bundle_version: body.bundle_version,
      schema_version: body.schema_version,
      scope_revision: body.scope_revision,
      next_change_at: body.next_change_at,
      map_manifest_ready: body.map_manifest_ready,
      fetched_at: now.toISOString(),
      unreadable_rows:
        assignments.length - tasks.length + body.map_manifests.length - manifests.length,
    },
  };
}
