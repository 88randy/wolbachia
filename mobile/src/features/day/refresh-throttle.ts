/**
 * [ASSUMPTION] Technical spacing between automatic refreshes of the day bundle; not a business rule.
 * Foreground returns (a permission prompt, the camera, a notification), reconnects and a due time
 * that is already past all asked for a bootstrap and a sync every 10 to 20 seconds while idle.
 */
export const MIN_AUTO_REFRESH_GAP_MS = 60_000;

/** Wraps a refresh so automatic triggers inside the gap are skipped; the first one always runs. */
export function throttleRefresh(
  refresh: () => Promise<void>,
  now: () => number,
  gapMs: number = MIN_AUTO_REFRESH_GAP_MS,
): () => Promise<void> {
  let lastStartedAt: number | null = null;
  return () => {
    const at = now();
    if (lastStartedAt !== null && at - lastStartedAt < gapMs) return Promise.resolve();
    lastStartedAt = at;
    return refresh();
  };
}
