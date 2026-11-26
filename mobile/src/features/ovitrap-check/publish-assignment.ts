import { StaleAssignmentAuthorityError } from "./snapshot-authority.ts";
import { warnAssignmentNull } from "./assignment-diagnostics.ts";
import type { OvitrapStore } from "./store.ts";
import type { Assignment } from "./types.ts";

export interface AssignmentProvider {
  read(): Promise<Assignment | null>;
}
const PUBLISH_ATTEMPTS = 3;
interface Rejected {
  readonly assignment: Assignment | null;
}
/** Null when published; the rejected assignment when a concurrent write moved the revision. */
async function publishOnce(
  assignments: AssignmentProvider,
  store: OvitrapStore,
): Promise<Rejected | null> {
  const authority = await store.assignmentAuthority();
  const assignment = await assignments.read();
  const { catalog, rules } = await store.snapshots();
  try {
    await store.publishSnapshots({ catalog, rules, assignment }, authority);
    return null;
  } catch (error) {
    if (error instanceof StaleAssignmentAuthorityError) return { assignment };
    throw error;
  }
}
/**
 * The assignment is local (the route's own bundle): publish it first, with no network wait, so the
 * capture never opens without the points of the route. A concurrent bundle write moves the
 * revision; read it again and retry instead of leaving the old (null) assignment in place.
 */
export async function publishAssignment(
  assignments: AssignmentProvider | undefined,
  store: OvitrapStore,
): Promise<void> {
  if (!assignments) return;
  let rejected: Rejected | null = { assignment: null };
  for (let attempt = 1; attempt <= PUBLISH_ATTEMPTS && rejected !== null; attempt += 1)
    rejected = await publishOnce(assignments, store);
  if (rejected === null) return;
  warnAssignmentNull(await store.publishBlockReason(rejected.assignment));
  throw new StaleAssignmentAuthorityError();
}
