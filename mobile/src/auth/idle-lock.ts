const MINUTE_MS = 60_000;
export interface IdleClock {
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
}
interface IdleLockDeps extends IdleClock {
  readonly warn: (isWarning: boolean) => void;
  readonly lock: () => void;
}

/** No React/native imports. A lock stops timers; every touch replaces both deadlines. */
export class IdleLock {
  readonly #deps: IdleLockDeps;
  #cancelWarning: (() => void) | null = null;
  #cancelLock: (() => void) | null = null;
  #minutes: number | null = null;
  #leftAt: number | null = null;
  #cancelGrace: (() => void) | null = null;
  constructor(deps: IdleLockDeps) {
    this.#deps = deps;
  }

  start(minutes: number): void {
    this.#minutes = minutes;
    this.touch();
  }
  touch(): void {
    this.stopTimers();
    this.#deps.warn(false);
    if (this.#minutes === null) return;
    this.#cancelWarning = this.#deps.schedule(
      () => {
        this.#deps.warn(true);
      },
      Math.max(0, this.#minutes - 1) * MINUTE_MS,
    );
    this.#cancelLock = this.#deps.schedule(() => {
      this.background();
    }, this.#minutes * MINUTE_MS);
  }

  /**
   * The app left the foreground (camera, permission dialog, Settings, home button).
   * It locks only if it stays away longer than the grace period; the idle timer keeps running.
   */
  leaveForeground(nowMs: number, graceMs: number): void {
    if (this.#leftAt !== null) return;
    this.#leftAt = nowMs;
    this.#cancelGrace = this.#deps.schedule(() => {
      this.#leftAt = null;
      this.#cancelGrace = null;
      this.background();
    }, graceMs);
  }
  /** Back in the foreground: lock only when the wall-clock time away exceeded the grace period. */
  returnToForeground(nowMs: number, graceMs: number): void {
    const leftAt = this.#leftAt;
    this.#cancelGrace?.();
    this.#cancelGrace = null;
    this.#leftAt = null;
    if (leftAt !== null && nowMs - leftAt >= graceMs) this.background();
  }
  background(): void {
    this.stop();
    this.#deps.lock();
  }
  stop(): void {
    this.#minutes = null;
    this.stopTimers();
    this.#deps.warn(false);
  }
  private stopTimers(): void {
    this.#cancelWarning?.();
    this.#cancelLock?.();
    this.#cancelWarning = null;
    this.#cancelLock = null;
  }
}
