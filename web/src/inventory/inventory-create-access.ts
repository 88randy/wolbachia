import { ApiError } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import { readInventoryOptionPage } from "./inventory-options";
import type { InventoryScope } from "./inventory-query";
import type { InventoryKind } from "./inventory-links";
import type { RetainedDraft } from "./use-inventory-draft";
import type { InventoryValues } from "./inventory-fields";
export interface CreationTarget {
  kind: "lots" | "locations";
  center: string;
  quadrant: string;
  location: string;
  locationCode: string;
}
export function creationTargetOf(
  kind: InventoryKind,
  draft?: RetainedDraft,
): CreationTarget | null {
  if (kind === "supplies" || !draft?.values["center_id"]) return null;
  const quadrant = draft.values["quadrant_id"] ?? "";
  if (!verifiableTarget(kind, draft.values)) return null;
  return {
    kind,
    center: draft.values["center_id"],
    quadrant,
    location: draft.values["initial_location_id"] || "none",
    locationCode: draft.values["initial_location_code"] ?? "",
  };
}
function verifiableTarget(kind: CreationTarget["kind"], values: InventoryValues) {
  return kind === "locations" ? Boolean(values["quadrant_id"]) : verifiableLocation(values);
}
function verifiableLocation(values: InventoryValues) {
  return (
    !values["initial_location_id"] ||
    values["initial_location_id"] === "none" ||
    Boolean(values["initial_location_code"])
  );
}
async function permittedPlacement(
  scope: InventoryScope,
  target: CreationTarget,
  signal: AbortSignal,
) {
  const request = {
    kind: "placements" as const,
    action: "lot.create" as const,
    center: target.center,
  };
  const search = target.location === "none" ? "" : target.locationCode;
  let page = 1;
  for (;;) {
    const answer = await readInventoryOptionPage(
      scope,
      { request, paging: { page, search } },
      signal,
    );
    const allowed = answer.results.some(
      (row) =>
        "location_id" in row &&
        !row.is_read_only &&
        row.location_id === (target.location === "none" ? null : target.location),
    );
    if (allowed) return true;
    if (!answer.next || answer.results.length === 0) return false;
    page += 1;
  }
}
/** Keep one action-filtered page at a time; absence from page one is not denial. */
async function verifyCreation(scope: InventoryScope, target: CreationTarget, signal: AbortSignal) {
  try {
    if (target.kind === "lots") return await permittedPlacement(scope, target, signal);
    const request = { kind: "owners" as const, center: target.center, quadrant: target.quadrant };
    await readInventoryOptionPage(scope, { request, paging: { page: 1, search: "" } }, signal);
    return true;
  } catch (error) {
    if (error instanceof ApiError && [400, 403, 404].includes(error.status)) return false;
    throw error;
  }
}
export function inventoryCreationAccessOptions(
  scope: InventoryScope,
  target: CreationTarget | null,
) {
  const permission = target?.kind === "lots" ? "lot.create" : "location.create";
  const allowed = scope.identity.permissions?.includes(permission) ?? false;
  const identity = {
    ...scope.identity,
    isSettled: scope.identity.isSettled && Boolean(target) && allowed,
  };
  return orgScopedQueryOptions(identity, {
    key: ["inventory", "creation-access", target],
    queryFn: ({ signal }) =>
      target ? verifyCreation(scope, target, signal) : Promise.resolve(false),
  });
}
