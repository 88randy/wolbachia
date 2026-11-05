/**
 * The server attests the identity of every response (#82, docs/api-conventions.md "Session
 * identity"): `X-Session-Identity` is an opaque HMAC of the (user, active organization, session) a
 * response was answered for. All tabs share one session cookie, so the web client cannot know from
 * its own state which identity a response belongs to; it compares the header with the one it holds
 * and discards a response that does not match, whatever the timing.
 *
 * The expected value is learned ONLY from an accepted `/me/` (or a login answer). It is cleared
 * whenever the client leaves `known` or is about to learn a new identity (reconcile, organization
 * switch), so the `/me/` that re-teaches it is never compared with the old one.
 */
export const IDENTITY_HEADER = "X-Session-Identity";

/** A response was answered for another identity than the request was issued under. */
export class IdentityMismatchError extends Error {
  constructor() {
    super("The response was answered for another session identity.");
    this.name = "IdentityMismatchError";
  }
}

let expected: string | undefined;
let onMismatch: (() => void) | undefined;

export function expectedAttestation(): string | undefined {
  return expected;
}

/** `undefined` (or an empty value) means "not known": nothing is compared. */
export function setExpectedAttestation(value: string | null | undefined): void {
  expected = value === null || value === undefined || value === "" ? undefined : value;
}

export function clearExpectedAttestation(): void {
  expected = undefined;
}

/** The app root wires what happens on a mismatch (leave `known` and reconcile). */
export function setIdentityMismatchHandler(handler: (() => void) | undefined): void {
  onMismatch = handler;
}

/** Tests only: module state must not leak between them. */
export function resetAttestation(): void {
  expected = undefined;
  onMismatch = undefined;
}

/** Login, logout and refresh change the identity on purpose: they are never compared. */
const AUTH_PATH_PREFIX = "/api/v1/auth/";

/** The expectation each request was issued under, by the unique id openapi-fetch gives it. */
const issuedUnder = new Map<string, string | undefined>();

interface Issued {
  id: string;
  schemaPath: string;
}

interface Answered extends Issued {
  response: Response;
}

/**
 * The api-client middleware (the one fetch layer of the web): it records what the request was
 * issued under, and when the response arrives with another attestation it never resolves the data:
 * it reports the mismatch (the root leaves `known` and reconciles) and throws.
 */
export const attestationMiddleware = {
  onRequest({ id, schemaPath }: Issued) {
    issuedUnder.set(id, schemaPath.startsWith(AUTH_PATH_PREFIX) ? undefined : expected);
    return undefined;
  },
  onResponse({ id, response }: Answered) {
    const under = issuedUnder.get(id);
    issuedUnder.delete(id);
    const got = response.headers.get(IDENTITY_HEADER);
    if (under === undefined || got === null || got === under) return undefined;
    onMismatch?.();
    throw new IdentityMismatchError();
  },
  onError({ id }: { id: string }) {
    issuedUnder.delete(id);
    return undefined;
  },
};
