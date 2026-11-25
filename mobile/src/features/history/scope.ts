import type { Schemas } from "@wolbachia/api-client";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { text } from "./domain.ts";

type Subject = Schemas["CourierHistoryEntry"]["subjects"][number];
interface Scope {
  readonly grants: Schemas["CaptureContext"]["grants"];
  readonly resources: readonly object[];
  readonly history: readonly Schemas["CourierHistoryEntry"][];
  readonly events: readonly OutboxEvent[];
}
function dimensionMatches(dimension: Schemas["ScopeDimension"], id: string | null): boolean {
  return (
    id === null ||
    dimension.mode === "all" ||
    (dimension.mode === "selected" && dimension.ids.includes(id))
  );
}
/** All concrete subjects must fit a complete pair; separate partial grants cannot combine. */
export function permitsSubjects(grants: Scope["grants"], subjects: readonly Subject[]): boolean {
  return (
    subjects.length > 0 &&
    grants.some((grant) =>
      subjects.every(
        (subject) =>
          (subject.center_id !== null || subject.quadrant_id !== null) &&
          dimensionMatches(grant.centers, subject.center_id) &&
          dimensionMatches(grant.quadrants, subject.quadrant_id),
      ),
    )
  );
}
function pointSubject(pointId: string | null, resources: readonly object[]): readonly Subject[] {
  const point = resources.find(
    (row) => text(row, "id") === pointId && text(row, "block_id") !== null,
  );
  if (!point) return [];
  const quadrant = resources.find(
    (row) =>
      text(row, "id") === text(point, "quadrant_id") && text(row, "resource_type") === "quadrant",
  );
  const block = resources.find(
    (row) => text(row, "id") === text(point, "block_id") && text(row, "resource_type") === "block",
  );
  if (
    !quadrant ||
    !block ||
    Reflect.get(quadrant, "_available") !== true ||
    Reflect.get(block, "_available") !== true
  )
    return [];
  if (
    text(block, "quadrant_id") !== text(quadrant, "id") ||
    text(block, "center_id") !== text(quadrant, "center_id")
  )
    return [];
  return [{ center_id: text(quadrant, "center_id"), quadrant_id: text(quadrant, "id") }];
}
function eventPoint(event: OutboxEvent, resources: readonly object[]): string | null {
  const payload = event.envelope.payload;
  const point = text(payload, "sampling_point_id") ?? text(payload, "point_id");
  if (point) return point;
  const physical = text(payload, "ovitrap_id");
  const trap = resources.find(
    (row) => text(row, "id") === physical && text(row, "sampling_point_id") !== null,
  );
  return trap ? text(trap, "sampling_point_id") : null;
}
function serverSources(event: OutboxEvent, scope: Scope) {
  return scope.history.filter(
    (row) =>
      text(row, "source_event_id") === event.envelope.id ||
      text(row, "proposal_event_id") === event.envelope.id,
  );
}
function sourceSubjects(event: OutboxEvent, scope: Scope): readonly Subject[] {
  const point = eventPoint(event, scope.resources);
  if (point) return pointSubject(point, scope.resources);
  return serverSources(event, scope).flatMap((row) => row.subjects);
}
/** D1 (#373): the exact own types P33 may list without a granted subject (verified producers). */
export const UNSCOPED_TYPES: readonly string[] = [
  "fuel.load",
  "supplies.receive",
  "supplies.reconcile",
  "incident.report",
  "emergency.accident",
  "shift.open",
  "shift.close",
];
const POINT_KEYS = ["sampling_point_id", "point_id", "ovitrap_id"] as const;
/** No point reference and no server history row placing it outside the current grant. */
function isUnplaced(event: OutboxEvent, scope: Scope): boolean {
  return (
    !POINT_KEYS.some((key) => text(event.envelope.payload, key) !== null) &&
    serverSources(event, scope).every(
      (row) => row.subjects.length === 0 || permitsSubjects(scope.grants, row.subjects),
    )
  );
}
/**
 * D1 (#373): exact whitelisted types only, never inference (#113). A `record.void` qualifies
 * through its original; a missing original or a void of a void stays hidden.
 */
export function isUnscopedOwn(event: OutboxEvent, scope: Scope): boolean {
  const target = event.envelope.voids_event_id;
  if (target && event.envelope.type !== "record.void") return false;
  const original = target
    ? scope.events.find((candidate) => candidate.envelope.id === target)
    : event;
  if (!original || original.envelope.voids_event_id) return false;
  return (
    UNSCOPED_TYPES.includes(original.envelope.type) &&
    isUnplaced(event, scope) &&
    isUnplaced(original, scope)
  );
}
/** Missing original subject proof is unavailable, never an organization-wide display grant. */
export function permitsLocal(event: OutboxEvent, scope: Scope): boolean {
  const target = event.envelope.voids_event_id;
  if (target) {
    const original = scope.events.find((candidate) => candidate.envelope.id === target);
    return original !== undefined && permitsSubjects(scope.grants, sourceSubjects(original, scope));
  }
  if (["shift.open", "shift.close"].includes(event.envelope.type)) {
    const validations = scope.history.filter(
      (row) => row.kind === "shift_validation" && row.shift_id === event.envelope.shift_id,
    );
    return permitsSubjects(
      scope.grants,
      validations.flatMap((row) => row.subjects),
    );
  }
  return permitsSubjects(scope.grants, sourceSubjects(event, scope));
}
