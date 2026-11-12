import type * as Location from "expo-location";
import type { LocationSource, LocationState } from "./location.ts";

/** [ASSUMPTION] Technical wait before the phone says it has no exact location; not a business rule. */
export const NO_FIX_WAIT_MS = 20_000;
/** Fresh enough for the speed lock without keeping the GPS chip at full speed. */
const WATCH_INTERVAL_MS = 3000;
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
    if (!this.#isStopped) this.#publish(state);
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

async function follow(api: Api, watch: Watch): Promise<void> {
  // Last known only fills the gap; nothing below waits for it.
  void api
    .getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })
    .then((last) => {
      if (last !== null && !watch.hasFix) watch.publish(fromNative(last));
    })
    .catch(() => undefined);
  void api
    .getCurrentPositionAsync({ accuracy: api.Accuracy.Balanced })
    .then(watch.onFix)
    .catch(() => undefined);
  // One watch only, with a real interval: an interval of 0 asks the chip for fixes as fast as it can.
  const subscription = await api.watchPositionAsync(
    { accuracy: api.Accuracy.Balanced, timeInterval: WATCH_INTERVAL_MS, distanceInterval: 0 },
    watch.onFix,
    () => undefined,
  );
  watch.onStop(() => {
    subscription.remove();
  });
}

/**
 * Foreground fixes only; the caller stops this on screen exit, background or closed shift. No pings.
 * It says "searching" as it starts and arms the no-fix wait at once, so a native call that never
 * answers still ends in noFix (never a search that goes on forever). One Balanced read and one
 * Balanced watch, which work indoors.
 */
export function createAndroidLocation(deps: LocationDeps): LocationSource {
  return {
    async start(publish) {
      const watch = new Watch(publish);
      watch.publish({ kind: "searching" });
      watch.onStop(
        deps.schedule(() => {
          if (!watch.hasFix) watch.publish({ kind: "noFix" });
        }, NO_FIX_WAIT_MS),
      );
      try {
        if (!(await isAllowed(deps.api, watch))) {
          watch.stop();
          return () => undefined;
        }
        await follow(deps.api, watch);
        return watch.stop;
      } catch {
        watch.publish({ kind: "noFix" });
        watch.stop();
        return () => undefined;
      }
    },
  };
}
