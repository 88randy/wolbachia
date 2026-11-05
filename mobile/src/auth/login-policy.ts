/**
 * The phone belongs to one courier while it holds any of their records. A different user may sign
 * in only on a phone with no local history: unsent work would be attributed to them, and sent,
 * rejected or in-review records would show them another person's activity in the inbox (P28).
 * Reassigning a phone is a reprovisioning by IT; the app never deletes records itself.
 */
export function canLoginAs(
  username: string,
  previousUsername: string | null,
  hasLocalRecords: boolean,
): boolean {
  if (username === previousUsername) return true;
  return !hasLocalRecords;
}
