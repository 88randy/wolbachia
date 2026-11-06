/** Native timers cannot represent delays above signed int32 milliseconds. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;
interface Dependencies {
  readonly dueAt: string;
  readonly now: () => number;
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
  readonly refresh: () => void;
}
/** Re-arm distant changes rather than firing early and losing their eventual deadline. */
export function scheduleDueRefresh(deps: Dependencies): () => void {
  let cancel: (() => void) | undefined;
  let isStopped = false;
  const due = Date.parse(deps.dueAt);
  const check = () => {
    if (isStopped || !Number.isFinite(due)) return;
    const remaining = due - deps.now();
    if (remaining <= 0) {
      deps.refresh();
      return;
    }
    cancel = deps.schedule(check, Math.min(remaining, MAX_TIMER_DELAY_MS));
  };
  check();
  return () => {
    isStopped = true;
    cancel?.();
  };
}
