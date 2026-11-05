import { unsentCount } from "./sync-snapshot.ts";
import type { SyncSnapshot } from "./sync-snapshot.ts";

/** The four states of the top-bar sync chip (design: "Main" board, issue #6). */
export type ChipState =
  | { readonly kind: "allSent" }
  | { readonly kind: "toUpload"; readonly count: number }
  | { readonly kind: "noSignal"; readonly count: number }
  | { readonly kind: "error" };

/**
 * Chooses the chip. Priority: a problem the courier or the app must act on (blocked worker, parked
 * events) beats "no signal", which beats "N to upload", which beats "all sent". Events the server
 * rejected or put in review do not turn the chip red: nothing is pending on the courier's side and
 * the inbox lists them.
 */
export function deriveChipState(snapshot: SyncSnapshot): ChipState {
  const unsent = unsentCount(snapshot.counts);
  const hasProblem = snapshot.counts.error > 0 || (snapshot.blockReason !== null && unsent > 0);
  if (hasProblem) return { kind: "error" };
  if (!snapshot.isOnline) return { kind: "noSignal", count: unsent };
  if (unsent > 0) return { kind: "toUpload", count: unsent };
  return { kind: "allSent" };
}
