import type { OutboxCounts } from "../outbox/outbox-repository.ts";
import type { BlockReason } from "./sync-failure.ts";

export type SyncPhase = "idle" | "syncing" | "waitingRetry" | "blocked";

/** Everything the screens need to know about syncing, in one immutable value. */
export interface SyncSnapshot {
  readonly counts: OutboxCounts;
  /** The phone reports a network connection (it may still not reach the server). */
  readonly isOnline: boolean;
  readonly phase: SyncPhase;
  readonly blockReason: BlockReason | null;
  /** Code of the last failure (`network`, `http_502`, `token_expired`, ...), for the inbox. */
  readonly lastFailureCode: string | null;
  /** ISO time of the last answer from the server. */
  readonly lastSyncAt: string | null;
}

export const EMPTY_COUNTS: OutboxCounts = {
  pending: 0,
  sending: 0,
  sent: 0,
  error: 0,
  in_review: 0,
  rejected: 0,
};

export const INITIAL_SNAPSHOT: SyncSnapshot = {
  counts: EMPTY_COUNTS,
  isOnline: true,
  phase: "idle",
  blockReason: null,
  lastFailureCode: null,
  lastSyncAt: null,
};

/** Events that are on the phone and not delivered (the number the chip shows). */
export function unsentCount(counts: OutboxCounts): number {
  return counts.pending + counts.sending + counts.error;
}
