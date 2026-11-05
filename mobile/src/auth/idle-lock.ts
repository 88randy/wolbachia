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
