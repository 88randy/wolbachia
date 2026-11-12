/**
 * Who may resolve a quadrant code or a person's name. The narrow lookup codes (`quadrant.lookup`,
 * `user.lookup`) serve only names, codes and outlines; the broad reads unlock the same lookups.
 * The backend checks the same lists (`geography/lookup_views.py`, `accounts/lookup_views.py`).
 */
export const QUADRANT_NAME_PERMISSIONS = ["quadrant.lookup", "quadrant.read"] as const;
export const PERSON_NAME_PERMISSIONS = [
  "user.lookup",
  "user.operational_read",
  "user.read",
] as const;

/** A required permission: one code, or a list where any one code is enough. */
export type RequiredPermission = string | readonly string[];

export function holdsAny(
  permissions: readonly string[] | undefined,
  required: RequiredPermission,
): boolean {
  const codes = typeof required === "string" ? [required] : required;
  return codes.some((code) => permissions?.includes(code) === true);
}
