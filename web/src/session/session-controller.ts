import type { QueryClient } from "@tanstack/react-query";
import { clearExpectedAttestation, setExpectedAttestation } from "./attestation";
import { forgetIdentity, notifyIdentityChange, recordIdentity } from "./identity";
import type { Me } from "./me";
import { ME_QUERY_KEY } from "./me-key";
import { isSessionQuery, removeOrganizationQueries } from "./organization-cache";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "./organization-slug";
import { endSessionExpiry } from "./session-events";
import {
  bumpEpoch,
  currentRevision,
  isSessionKnown,
  isVerifyingOnly,
  sessionState,
  setSessionState,
  setSignedOut,
} from "./session-revision";
import { broadcastSessionChanged } from "./session-sync";

/**
 * THE single writer of the session (#82). Orchestrator decision: one module owns the epoch, the
 * state (`known` | `reconciling` | `unknown`), the organization slug, the recorded identity, the
 * expected attestation and the cached `/me/`; nothing else writes them (a test fails otherwise).
 *
 * - Every operation (login, re-authentication, sign-out, organization switch, reconcile, a 401, a
 *   cross-tab event) starts with `begin()`. It returns a FRESH TOKEN (epoch after `leaveKnown`
 *   when it leaves `known`, plus a unique operation id): no two operations share a token, so only
 *   the most recently begun one can commit (latest wins).
 * - Operations never publish. They produce a CANDIDATE from the network response itself (never
 *   from reading the query cache afterwards) and call `commitKnown(token, candidate)`, which checks
 *   `isLatest(token)` (the token is the latest begun operation, in its epoch) synchronously and only then writes everything in ONE step. A stale
 *   candidate is dropped and nothing happens.
 * - Failure paths never restore anything: a failed operation does nothing if its token is stale,
 *   or calls `leaveKnown` if it is current (`failIfCurrent`). After a failed switch the session is
 *   `unknown` and the tab reconciles.
 * - `leaveKnown` always bumps the epoch, so it invalidates every token in flight.
 */
export interface Token {
  readonly epoch: number;
  /** Unique per `begin()`: no two operations ever share a token. */
  readonly operation: number;
}

let latestOperation = 0;

/** Strictly latest-wins: only the most recently begun operation, in the epoch it began in, may commit. */
export function isLatest(token: Token): boolean {
  return token.operation === latestOperation && token.epoch === currentRevision();
}

export interface Candidate {
  me: Me;
  /** `X-Session-Identity` of the answer that produced `me`. */
  attestation: string | null | undefined;
  /** The organization slug to store: a value sets it, `null` forgets it, `undefined` keeps it. */
  slug?: string | null;
}

export interface CommitOptions {
  /** A login replaces whatever a previous user left: the whole cache is cleared first. */
  replace?: boolean;
  /** A login or an organization switch changes the shared session: tell the other tabs. */
  announce?: boolean;
  /** A login invalidates the tokens of every request sent before it. */
  bumpEpoch?: boolean;
  /**
   * A plain read of `/me/` (a guard, a refresh): it only keeps what is known up to date. It
   * publishes nothing unless the tab is `known`, and it never ends an expiry or changes the state:
   * those belong to the operations that begin with `leave` or `verify`.
   */
  passive?: boolean;
}

export type BeginKind = "leave" | "verify" | "passive";

/**
 * The one transition out of `known`, for any reason. In this order and synchronously: the epoch
 * changes (every token in flight is stale), pending queries are cancelled, org-scoped data and
 * placeholders are removed, the recorded identity and the expected attestation are forgotten and
 * the state becomes `unknown`. The cached `/me/` is only marked stale by the next verified one:
 * the shell and the re-authentication dialog still read the user from it. Returns the
 * cancellation, which the caller may await.
 */
export function leaveKnown(queryClient: QueryClient): Promise<void> {
  bumpEpoch();
  const cancelled = queryClient.cancelQueries({ predicate: isSessionQuery });
  removeOrganizationQueries(queryClient);
  forgetIdentity(queryClient);
  clearExpectedAttestation();
  setSessionState("unknown");
  void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY, refetchType: "none" });
  return cancelled;
}

/**
 * Starts an operation and returns its token. `leave`: the operation changes who the tab is
 * (login, reconcile, organization switch): the tab leaves `known` first and is `reconciling`.
 * `verify`: only checking (window focus): `reconciling`, nothing is touched. `passive`: a plain
 * read of `/me/`, no state change.
 */
export function begin(queryClient: QueryClient, kind: BeginKind): Token {
  if (kind === "leave") {
    void leaveKnown(queryClient);
    setSessionState("reconciling");
  } else if (kind === "verify") {
    // A check on top of a `known` tab (or of another check) changes nothing; on top of a leave it
    // stays a leave.
    setSessionState("reconciling", sessionState() === "known" || isVerifyingOnly());
  }
  latestOperation += 1; // a verify or a passive begin takes a new identity but clears nothing
  return { epoch: currentRevision(), operation: latestOperation };
}

/**
 * The token of a plain read of `/me/` (a guard, a refresh): it is NOT an operation. It takes no
 * operation id, so it never makes an operation in flight stale (no churn); any operation begun
 * after it does make the read stale, and the read only commits while the tab is `known`
 * (`passive`), which no operation in flight allows.
 */
export function readToken(): Token {
  return { epoch: currentRevision(), operation: latestOperation };
}

/** What a commit publishes (the candidate) and how (the flags). */
export type Publication = Candidate & CommitOptions;

/** The candidate's slug, identity, attestation and `/me/`, in one synchronous step. */
function write(queryClient: QueryClient, candidate: Candidate): void {
  setExpectedAttestation(candidate.attestation);
  if (candidate.slug === null) clearOrganizationSlug();
  else if (candidate.slug !== undefined) setOrganizationSlug(candidate.slug);
  if (recordIdentity(queryClient, candidate.me)) {
    // Another identity than the one recorded: everything of the old one is stale at once.
    bumpEpoch();
    removeOrganizationQueries(queryClient);
    notifyIdentityChange();
  }
  queryClient.setQueryData(ME_QUERY_KEY, candidate.me);
}

/**
 * Publishes a candidate if, and only if, its token is still the epoch: the state, the slug, the
 * recorded identity, the expected attestation and the `/me/` cache entry, in one step. Returns
 * whether it was committed. A stale candidate changes nothing.
 */
export function commitKnown(
  queryClient: QueryClient,
  token: Token,
  publication: Publication,
): boolean {
  if (!isLatest(token)) return false;
  if (publication.passive === true && !isSessionKnown()) return false;
  if (publication.replace === true) {
    queryClient.clear();
    forgetIdentity(queryClient);
  }
  write(queryClient, publication);
  setSignedOut(false);
  if (publication.passive !== true) {
    endSessionExpiry();
    setSessionState("known");
  }
  if (publication.bumpEpoch === true) bumpEpoch();
  if (publication.announce === true) broadcastSessionChanged();
  return true;
}

/**
 * The server answered, definitively, that there is no identity to learn (no membership at all):
 * nothing is published, the tab is not `unknown`, and the route guards send the user to sign in.
 * Only for a current token.
 */
export function settleWithoutIdentity(token: Token): void {
  if (isLatest(token)) setSessionState("known");
}

/** A failed operation: only one whose token is current takes the tab out of `known`. */
export function failIfCurrent(queryClient: QueryClient, token: Token): Promise<void> {
  return isLatest(token) ? leaveKnown(queryClient) : Promise.resolve();
}

/**
 * The server confirmed the sign-out. Committed only for a current token; a stale one means the
 * session moved meanwhile, so nothing is published and the caller reconciles. Nobody is signed in
 * afterwards: the identity and the organization are forgotten and the other tabs are told.
 */
export function commitSignedOut(queryClient: QueryClient, token: Token): number | undefined {
  if (!isLatest(token)) return undefined;
  bumpEpoch();
  void queryClient.cancelQueries({ predicate: isSessionQuery });
  removeOrganizationQueries(queryClient);
  forgetIdentity(queryClient);
  clearExpectedAttestation();
  clearOrganizationSlug();
  endSessionExpiry();
  setSignedOut(true);
  setSessionState("known");
  broadcastSessionChanged();
  return currentRevision();
}

/**
 * After the sign-in page opened: empty the cache, but only if nothing happened since the sign-out
 * (`epoch` is the one `commitSignedOut` returned): a sign-in accepted meanwhile keeps its session.
 */
export function clearAfterSignOut(queryClient: QueryClient, epoch: number): void {
  if (epoch === currentRevision()) queryClient.clear();
}

/**
 * A login the server confirmed but whose token went stale (another tab moved the session): its
 * body is not published. The cookie changed, so the epoch changes and the other tabs are told;
 * the caller reconciles with `/me/` to learn who the cookie belongs to.
 */
export function noteStaleLogin(): void {
  bumpEpoch();
  broadcastSessionChanged();
}

/** The server refused this organization slug (`no_active_membership`): forget it, only if unchanged. */
export function forgetRefusedSlug(slug: string): void {
  if (getOrganizationSlug() === slug) clearOrganizationSlug();
}

/** The user left the sign-in page's session behind: a slug kept in the browser belongs to nobody. */
export function forgetSlugWithoutSession(queryClient: QueryClient): void {
  if (queryClient.getQueryData(ME_QUERY_KEY) === undefined) clearOrganizationSlug();
}

/** The membership in the chosen organization ended: the slug is no longer valid. */
export function forgetSlugOfLostMembership(): void {
  clearOrganizationSlug();
}
