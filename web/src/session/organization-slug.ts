import { readStored, removeStored, STORAGE_KEYS, writeStored } from "../storage/safe-storage";

/**
 * The slug of the organization the user chose, for users with several memberships. The web
 * session does not pin an organization, so the slug travels as the `X-Organization` header on
 * every request (never in a URL or a body). It is kept in memory and in `localStorage` so a
 * reload keeps the choice; it is cleared on sign-out. It is a preference, not a credential:
 * the server revalidates the membership on every request.
 */
const SLUG_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

let memorySlug: string | undefined;

function isSlug(value: string | null | undefined): value is string {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}

/** Current slug, or undefined when the user has not chosen one. A malformed stored value is dropped. */
export function getOrganizationSlug(): string | undefined {
  if (memorySlug !== undefined) return memorySlug;
  const stored = readStored(STORAGE_KEYS.organization);
  if (stored === null) return undefined;
  if (!isSlug(stored)) {
    removeStored(STORAGE_KEYS.organization);
    return undefined;
  }
  memorySlug = stored;
  return stored;
}

/** Remembers the chosen organization. A slug the API could not have produced is ignored. */
export function setOrganizationSlug(slug: string): void {
  if (!isSlug(slug)) return;
  memorySlug = slug;
  writeStored(STORAGE_KEYS.organization, slug);
}

/** Forgets the chosen organization (sign-out, or a slug that is no longer valid). */
export function clearOrganizationSlug(): void {
  memorySlug = undefined;
  removeStored(STORAGE_KEYS.organization);
}
