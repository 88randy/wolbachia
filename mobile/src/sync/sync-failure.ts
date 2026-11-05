import { retryAfterDelayMs } from "./backoff.ts";

/** What went wrong with a sync request, before deciding what to do about it. */
export type SyncFailure =
  /** No answer at all: offline, DNS, timeout, connection reset. */
  | { readonly kind: "network" }
  /** The server answered with an error status. `code` is the error envelope's code (or `unknown_error`). */
  | {
      readonly kind: "http";
      readonly status: number;
      readonly code: string;
      /** Field names named by a `validation_error` (`fields` keys with their codes). */
      readonly fieldCodes: Readonly<Record<string, readonly string[]>>;
      readonly retryAfterSeconds: number | null;
    };

/** Why the worker stopped until something outside it changes. */
export type BlockReason =
  /** No valid session: sign in again (#7). */
  | "needsLogin"
  /** The phone's date and time are wrong (`sent_at` out of range). Fix them and the events go out. */
  | "clockWrong"
  /** No server address is configured (Settings, or the build's `EXPO_PUBLIC_API_BASE_URL`). */
  | "noServer"
  /** The account may not sync (`permission_denied`, `no_active_membership`). A person must fix it. */
  | "forbidden";

/** What the sync pass does next. The table is in `docs/sync.md`, "What the phone does after a batch error". */
export type FailurePlan =
  /** Try again later; counts as an attempt (no network, 5xx, anything unexpected). */
  | { readonly action: "retry"; readonly retryAfterMs: number | null }
  /** Try again later; the server asked us to wait and the events did nothing wrong. */
  | { readonly action: "wait"; readonly retryAfterMs: number }
  /** Forget the cursor and ask again from the start. */
  | { readonly action: "resetCursor" }
  /** Send smaller batches. */
  | { readonly action: "splitBatch" }
  /** Stop until sign-in, clock or permissions change. */
  | { readonly action: "block"; readonly reason: BlockReason }
  /** The request can never succeed as built: park the events as `error`. */
  | { readonly action: "park" };

const AUTH_CODES: ReadonlySet<string> = new Set([
  "not_authenticated",
  "invalid_token",
  "token_expired",
  "session_revoked",
  "device_mismatch",
]);
const FORBIDDEN_CODES: ReadonlySet<string> = new Set(["permission_denied", "no_active_membership"]);
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;
const HTTP_PAYLOAD_TOO_LARGE = 413;
const HTTP_TOO_MANY_REQUESTS = 429;
/** Wait applied to a `429` that came without `Retry-After`. */
const DEFAULT_WAIT_SECONDS = 2;

export interface PlanContext {
  /** Events in the request that failed. */
  readonly batchSize: number;
  /** True when a `reset the cursor` was already tried in this pass, so it cannot loop. */
  readonly cursorAlreadyReset: boolean;
}

type HttpFailure = Extract<SyncFailure, { kind: "http" }>;

function planBadRequest(failure: HttpFailure, context: PlanContext): FailurePlan {
  if (failure.code === "invalid_cursor") {
    return context.cursorAlreadyReset
      ? { action: "retry", retryAfterMs: null }
      : { action: "resetCursor" };
  }
  if (failure.code === "validation_error" && "sent_at" in failure.fieldCodes) {
    return { action: "block", reason: "clockWrong" };
  }
  return { action: "park" };
}

function planWait(failure: HttpFailure): FailurePlan {
  const seconds = failure.retryAfterSeconds ?? DEFAULT_WAIT_SECONDS;
  return { action: "wait", retryAfterMs: retryAfterDelayMs(seconds) };
}

/** Decides what a failed sync request means. Pure: no clock, no randomness, no I/O. */
export function planFailure(failure: SyncFailure, context: PlanContext): FailurePlan {
  if (failure.kind === "network") return { action: "retry", retryAfterMs: null };
  const { status, code } = failure;
  if (AUTH_CODES.has(code) || status === HTTP_UNAUTHORIZED) {
    return { action: "block", reason: "needsLogin" };
  }
  if (FORBIDDEN_CODES.has(code) || status === HTTP_FORBIDDEN) {
    return { action: "block", reason: "forbidden" };
  }
  if (status === HTTP_TOO_MANY_REQUESTS) return planWait(failure);
  if (status === HTTP_PAYLOAD_TOO_LARGE) {
    return context.batchSize > 1 ? { action: "splitBatch" } : { action: "park" };
  }
  if (status === HTTP_BAD_REQUEST) return planBadRequest(failure, context);
  return { action: "retry", retryAfterMs: null };
}
