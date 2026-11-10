import type { Schemas } from "@wolbachia/api-client";
import { isConfiguredType } from "./incident-types-query";
import type { TypeTarget } from "./incident-types-query";
export function isEditableBlocker(value: unknown): value is Schemas["BlockerKindsEnum"] {
  return value === "dispatch" || value === "quadrant_closure";
}
/** System-owned kinds remain exact when a human edits another part of this configuration. */
export function hasReadOnlyBlockers(item?: TypeTarget): boolean {
  return (
    isConfiguredType(item) &&
    (!Array.isArray(item.blocker_kinds) ||
      item.blocker_kinds.some((value: unknown) => !isEditableBlocker(value)))
  );
}
