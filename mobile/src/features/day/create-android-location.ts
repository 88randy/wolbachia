import type * as Location from "expo-location";
import type { LocationSource, LocationState } from "./location.ts";

/** [ASSUMPTION] Technical wait before the phone says it has no exact location; not a business rule. */
export const NO_FIX_WAIT_MS = 20_000;
/** A last known position older than this is not shown as the start point. */
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000;

function fromNative(fix: Location.LocationObject): LocationState {
  return {
    kind: "granted",
    fix: {
      lat: fix.coords.latitude,
      lng: fix.coords.longitude,
      accuracy_m: fix.coords.accuracy,
      fixedAt: fix.timestamp,
      speed_mps: fix.coords.speed,
    },
  };
}

type Api = Pick<
  typeof Location,
  | "hasServicesEnabledAsync"
  | "requestForegroundPermissionsAsync"
  | "getLastKnownPositionAsync"
  | "getCurrentPositionAsync"
  | "watchPositionAsync"
  | "Accuracy"
>;
export interface LocationDeps {
  readonly api: Api;
  /** Schedules the no-fix wait; injected so tests release it by hand. */
  readonly schedule: (run: () => void, ms: number) => () => void;
}

/** One running watch: what to undo on stop, and whether any fix has arrived yet. */
class Watch {
  readonly #removers: (() => void)[] = [];
  readonly #publish: (state: LocationState) => void;
  #isStopped = false;
  hasFix = false;
  constructor(publish: (state: LocationState) => void) {
    this.#publish = publish;
  }
  get isStopped(): boolean {
    return this.#isStopped;
  }
  onFix = (fix: Location.LocationObject): void => {
    if (this.#isStopped) return;
    this.hasFix = true;
    this.#publish(fromNative(fix));
  };
  publish(state: LocationState): void {
    this.#publish(state);
  }
  onStop(remove: () => void): void {
    this.#removers.push(remove);
  }
  stop = (): void => {
    this.#isStopped = true;
    for (const remove of this.#removers) remove();
  };
}

/** Services on and permission granted, or the reason why not (already published). */
async function isAllowed(api: Api, watch: Watch): Promise<boolean> {
  if (!(await api.hasServicesEnabledAsync())) {
    watch.publish({ kind: "off" });
    return false;
  }
  if (!(await api.requestForegroundPermissionsAsync()).granted) {
    watch.publish({ kind: "denied" });
    return false;
  }
  return true;
}

async function follow(deps: LocationDeps, watch: Watch): Promise<void> {
  const { api, schedule } = deps;
  const last = await api.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
  watch.publish(last === null ? { kind: "searching" } : fromNative(last));
  watch.onStop(
    schedule(() => {
      if (!watch.isStopped && !watch.hasFix) watch.publish({ kind: "noFix" });
    }, NO_FIX_WAIT_MS),
  );
  void api
    .getCurrentPositionAsync({ accuracy: api.Accuracy.Balanced })
    .then(watch.onFix)
    .catch(() => undefined);
  for (const accuracy of [api.Accuracy.Balanced, api.Accuracy.High]) {
    const subscription = await api.watchPositionAsync({ accuracy }, watch.onFix, () => undefined);
    watch.onStop(() => {
      subscription.remove();
    });
  }
}

/**
 * Foreground fixes only; the caller stops this on screen exit, background or closed shift. No pings.
 * Quick start: last known position, one Balanced read and a Balanced watch (they work indoors),
 * then a High accuracy watch that refines. If nothing arrives in time it says noFix, once.
 */
export function createAndroidLocation(deps: LocationDeps): LocationSource {
  return {
    async start(publish) {
      const watch = new Watch(publish);
      try {
        if (!(await isAllowed(deps.api, watch))) return () => undefined;
        await follow(deps, watch);
        return watch.stop;
      } catch {
        watch.stop();
        publish({ kind: "noFix" });
        return () => undefined;
      }
    },
  };
}
