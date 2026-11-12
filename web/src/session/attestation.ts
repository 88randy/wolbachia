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

/**
 * Never compared: login, logout and refresh change the identity on purpose, and the public portal
 * answers anonymous visitors with the same aggregates for everyone (no session, so no header).
 */
const EXEMPT_PATH_PREFIXES = ["/api/v1/auth/", "/api/v1/portal/"];
/** `/me/` is how an identity is learned: it may be answered while no value is expected yet. */
const ME_PATH = "/api/v1/me/";

type Kind = "exempt" | "me" | "scoped";

/** What each request was issued under, by the unique id openapi-fetch gives it. */
const issuedUnder = new Map<string, { kind: Kind; expected: string | undefined }>();

function kindOf(schemaPath: string): Kind {
  if (EXEMPT_PATH_PREFIXES.some((prefix) => schemaPath.startsWith(prefix))) return "exempt";
  return schemaPath === ME_PATH ? "me" : "scoped";
}

interface Issued {
  id: string;
  schemaPath: string;
}

interface Answered extends Issued {
  response: Response;
}

/**
 * Whether a response is attested for the identity its request was issued under. Only successful
 * answers carry data, so only they are compared (an error answer may legitimately come before the
 * organization is resolved and carries nothing to store). While NO value is expected only `/me/`
 * (which teaches it) and `/auth/` may pass: any other 2xx answer is rejected, never "accepted
 * because nothing is known". An answer without the header cannot be attested and is rejected too.
 */
function isAttested(kind: Kind, under: string | undefined, response: Response): boolean {
  if (kind === "exempt" || !response.ok) return true;
  if (under === undefined) return kind === "me";
  return response.headers.get(IDENTITY_HEADER) === under;
}

/**
 * The api-client middleware (the one fetch layer of the web): it records what the request was
 * issued under, and when the response is not attested it never resolves the data: it reports the
 * mismatch (the root leaves `known` and reconciles) and throws.
 */
export const attestationMiddleware = {
  onRequest({ id, schemaPath }: Issued) {
    issuedUnder.set(id, { kind: kindOf(schemaPath), expected });
    return undefined;
  },
  onResponse({ id, response }: Answered) {
    const issued = issuedUnder.get(id);
    issuedUnder.delete(id);
    if (issued === undefined || isAttested(issued.kind, issued.expected, response))
      return undefined;
    onMismatch?.();
    throw new IdentityMismatchError();
  },
  onError({ id }: { id: string }) {
    issuedUnder.delete(id);
    return undefined;
  },
};
