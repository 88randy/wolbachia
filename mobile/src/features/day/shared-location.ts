import type { LocationSource, LocationState } from "./location.ts";

/** [ASSUMPTION] Technical grace before the last viewer lets the native watch go; not a business rule. */
export const SHARED_STOP_GRACE_MS = 2000;

interface Deps {
  readonly source: LocationSource;
  /** Schedules the grace; injected so tests release it by hand. */
  readonly schedule: (run: () => void, ms: number) => () => void;
}

/**
 * One native watch for the whole app. Every screen and the safety monitor attach to it and get the
 * last state at once. Detaching the last one does not stop the watch right away: a flapping
 * dependency (shift flag, app state) used to tear it down and start it again several times a
 * second, which kept the phone location indicator blinking and never let a fix arrive.
 */
export class SharedLocationSource implements LocationSource {
  readonly #deps: Deps;
  readonly #listeners = new Set<(state: LocationState) => void>();
  #running: Promise<() => void> | null = null;
  #last: LocationState | null = null;
  #cancelGrace: (() => void) | null = null;
  constructor(deps: Deps) {
    this.#deps = deps;
  }
  start(publish: (state: LocationState) => void): Promise<() => void> {
    this.#cancelGrace?.();
    this.#cancelGrace = null;
    // Off or denied is not a watch worth keeping: a new viewer (after a settings trip) tries again.
    if (this.#last?.kind === "off" || this.#last?.kind === "denied") this.#reset();
    this.#listeners.add(publish);
    if (this.#last !== null) publish(this.#last);
    this.#running ??= this.#deps.source.start((state) => {
      this.#last = state;
      for (const listener of [...this.#listeners]) listener(state);
    });
    return Promise.resolve(() => {
      this.#detach(publish);
    });
  }
  #detach(publish: (state: LocationState) => void): void {
    this.#listeners.delete(publish);
    if (this.#listeners.size > 0 || this.#cancelGrace !== null) return;
    this.#cancelGrace = this.#deps.schedule(() => {
      this.#cancelGrace = null;
      this.#reset();
    }, SHARED_STOP_GRACE_MS);
  }
  #reset(): void {
    const running = this.#running;
    this.#running = null;
    this.#last = null;
    void running?.then((stop) => {
      stop();
    });
  }
}
