import type { LocationSource, LocationState } from "./location.ts";

/** The app-in-front signal, injected so tests drive it by hand. */
export interface AppStatePort {
  readonly current: () => string;
  readonly onChange: (listener: (state: string) => void) => () => void;
}

export interface LocationSubscriptionInput {
  readonly source: LocationSource;
  /** True only when location is needed now: unlocked with an open shift. */
  readonly isNeeded: boolean;
  readonly publish: (state: LocationState) => void;
  readonly app: AppStatePort;
}

/**
 * Starts the source when location is needed and the app is in front. "searching" only ever comes
 * from a source that has started. When location is not needed the state is "unavailable", which
 * shows no banner. A generation cancels late promises.
 */
export function subscribeLocation(input: LocationSubscriptionInput): () => void {
  const { source, isNeeded, publish, app } = input;
  let generation = 0;
  let stop: (() => void) | undefined;
  const update = () => {
    const current = ++generation;
    stop?.();
    stop = undefined;
    if (!isNeeded) {
      publish({ kind: "unavailable" });
      return;
    }
    if (app.current() !== "active") return;
    void source
      .start((fix) => {
        if (current === generation) publish(fix);
      })
      .then((cancel) => {
        if (current !== generation) cancel();
        else stop = cancel;
      })
      .catch(() => {
        if (current === generation) publish({ kind: "noFix" });
      });
  };
  update();
  // Only a real change between in front and not in front restarts the watch.
  let wasActive = app.current() === "active";
  const remove = app.onChange((state) => {
    const isActive = state === "active";
    if (isActive === wasActive) return;
    wasActive = isActive;
    update();
  });
  return () => {
    generation += 1;
    stop?.();
    remove();
  };
}
