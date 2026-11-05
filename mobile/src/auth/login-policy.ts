import type { OutboxCounts } from "../outbox/outbox-repository.ts";

/** The owner binding survives credential erasure; never attribute unsent work to a new user. */
export function canLoginAs(
  username: string,
  previousUsername: string | null,
  counts: OutboxCounts,
): boolean {
  if (username === previousUsername) return true;
  return counts.pending + counts.sending + counts.error === 0;
}
