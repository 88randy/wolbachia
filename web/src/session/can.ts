import type { Me } from "./me";

/**
 * Whether the user holds a permission code (`<resource>.<action>`, e.g. `catalog.read`). The
 * codes come from `GET /me/`, the union of the user's active profiles: profile names are never
 * used to decide anything. A user with no active organization has no permissions.
 *
 * Scope (centers, quadrants) is not checked here: its meaning is [PENDING backend] (an empty
 * list may mean "whole organization" or "nothing"). The server enforces scope on every request.
 */
export function can(me: Pick<Me, "permissions">, permission: string): boolean {
  return me.permissions.includes(permission);
}

/** Whether the user holds at least one of the codes. An empty list grants nothing. */
export function canAny(me: Pick<Me, "permissions">, permissions: readonly string[]): boolean {
  return permissions.some((permission) => can(me, permission));
}
