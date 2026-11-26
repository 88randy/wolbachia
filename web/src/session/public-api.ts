/**
 * The one place that says which API answers belong to no session: the public portal
 * (`/api/v1/portal/...`), read anonymously and answered with the same aggregates for everyone.
 *
 * Both the attestation check (`attestation.ts`) and the cache drop on a session change
 * (`organization-cache.ts`) ask this predicate, by API path. A cached answer is public only when
 * its query key starts with that API path, so a private query can never be kept across sessions
 * by picking a look-alike key. `/api/v1/portal-settings/` is private: the prefix ends in a slash.
 */
const PUBLIC_API_PREFIXES = ["/api/v1/portal/"] as const;

export function isPublicApiPath(path: unknown): boolean {
  return typeof path === "string" && PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix));
}
