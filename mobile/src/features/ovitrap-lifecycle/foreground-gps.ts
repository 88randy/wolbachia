import type { LocationSource, LocationState } from "../day/location.ts";
import { currentLocation } from "../day/location.ts";
import type { GpsPort } from "../ovitrap-check/types.ts";
interface Activity {
  readonly isActive: () => boolean;
  readonly subscribe: (listener: () => void) => () => void;
}
interface Dependencies {
  readonly source: LocationSource;
  readonly activity: Activity;
  readonly now: () => Date;
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
}
type Fix = Awaited<ReturnType<GpsPort["locate"]>>;
function usableFix(state: LocationState, now: Date): Fix | undefined {
  const current = currentLocation(state, now);
  if (current.kind === "unavailable" || current.kind === "denied") return null;
  if (current.kind !== "granted" || current.fix.fixedAt > now.getTime()) return undefined;
  return { lat: current.fix.lat, lng: current.fix.lng, accuracy_m: current.fix.accuracy_m };
}
function attempt(complete: (value: Fix) => void) {
  let ended = false;
  const stops: (() => void)[] = [];
  return {
    isEnded: () => ended,
    install: (stop: () => void) => {
      if (ended) stop();
      else stops.push(stop);
    },
    finish: (value: Fix) => {
      if (ended) return;
      ended = true;
      stops.forEach((stop) => {
        stop();
      });
      complete(value);
    },
  };
}
function startForeground(deps: Dependencies, complete: (value: Fix) => void): () => void {
  const current = attempt(complete),
    cancel = () => {
      current.finish(null);
    };
  current.install(
    deps.activity.subscribe(() => {
      if (!deps.activity.isActive()) cancel();
    }),
  );
  if (current.isEnded()) return cancel;
  current.install(deps.schedule(cancel, 10_000));
  void deps.source
    .start((state) => {
      if (current.isEnded() || !deps.activity.isActive()) return;
      const value = usableFix(state, deps.now());
      if (value !== undefined) current.finish(value);
    })
    .then((stop) => {
      current.install(stop);
    }, cancel);
  return cancel;
}
/** Foreground only; 10s is a bounded technical wait, never a business or accuracy threshold. */
export class ForegroundLifecycleGps implements GpsPort {
  readonly #deps: Dependencies;
  #cancel: () => void = () => undefined;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  cancel = () => {
    this.#cancel();
  };
  locate(): ReturnType<GpsPort["locate"]> {
    this.cancel();
    if (!this.#deps.activity.isActive()) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.#cancel = startForeground(this.#deps, resolve);
    });
  }
}
