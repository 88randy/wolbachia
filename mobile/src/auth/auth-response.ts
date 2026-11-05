import type { Schemas } from "@wolbachia/api-client";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
export function isTokenPair(
  value: unknown,
): value is Pick<Schemas["RefreshResponse"], "access" | "refresh"> {
  return isRecord(value) && isNonempty(value.access) && isNonempty(value.refresh);
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry: unknown) => typeof entry === "string");
}
function isOrganization(value: unknown): boolean {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return (
    [value.id, value.slug, value.name, value.country, value.timezone].every(isNonempty) &&
    isStringArray(value.languages) &&
    (value.logo_url === null || typeof value.logo_url === "string")
  );
}
/** Validate the generated response's fields consumed by profileOf and clock-skew handling. */
export function isLoginResponse(value: unknown): value is Schemas["MobileLoginResponse"] {
  if (!isTokenPair(value) || !isRecord(value)) return false;
  const response: Record<string, unknown> = value;
  if (
    typeof response.server_time !== "string" ||
    !Number.isFinite(Date.parse(response.server_time))
  )
    return false;
  const me = response.me;
  if (!isRecord(me) || !isRecord(me.user)) return false;
  return (
    isNonempty(me.user.username) &&
    typeof me.user.first_name === "string" &&
    isOrganization(me.organization) &&
    isStringArray(me.permissions)
  );
}
