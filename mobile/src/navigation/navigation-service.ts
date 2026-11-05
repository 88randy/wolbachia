import type { KvStore } from "../db/kv-store.ts";
import { isCoordinates } from "../features/day/assignment-parser.ts";
export type NavigationOutcome = "launched" | "no_handler" | "denied" | "invalid_coordinates";
export interface NavigationLauncher {
  launch(uri: string): Promise<"launched" | "no_handler" | "denied">;
}
export interface NavigationPoint {
  readonly id: string;
  readonly point_code: string;
  readonly lat: number;
  readonly lng: number;
}
export interface NavigationState {
  readonly pointId: string;
  readonly outcome: NavigationOutcome | null;
  readonly time: string;
  readonly revision: number;
}
export const NAVIGATION_KEY = "day_navigation";
/** Only validated coordinates and the sampling point code leave the app. No reference text or organization. */
export function geoUri(point: NavigationPoint): string | null {
  if (!isCoordinates(point.lat, point.lng)) return null;
  const coordinates = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
  const label = encodeURIComponent(point.point_code).replace(
    /[()]/g,
    (char) => `%${char.charCodeAt(0).toString(16)}`,
  );
  return `geo:${coordinates}?q=${coordinates}(${label})`;
}
interface Dependencies {
  readonly kv: KvStore;
  readonly launcher: NavigationLauncher;
  readonly now: () => Date;
}
/** Selection is committed before leaving the app; a failed write never reports a successful action. */
export class NavigationService {
  readonly #deps: Dependencies;
  #revision = 0;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  async read(): Promise<NavigationState | null> {
    const saved = await this.#deps.kv.get(NAVIGATION_KEY);
    return saved === null ? null : (JSON.parse(saved) as NavigationState);
  }
  async clear(): Promise<void> {
    await this.#deps.kv.remove(NAVIGATION_KEY);
  }
  async select(pointId: string): Promise<string> {
    const saved = JSON.stringify({
      pointId,
      outcome: null,
      time: this.#deps.now().toISOString(),
      revision: ++this.#revision,
    });
    await this.#deps.kv.set(NAVIGATION_KEY, saved);
    return saved;
  }
  async launch(point: NavigationPoint): Promise<NavigationState> {
    const selection = await this.select(point.id);
    const uri = geoUri(point);
    const outcome: NavigationOutcome =
      uri === null
        ? "invalid_coordinates"
        : await this.#deps.launcher.launch(uri).catch(() => "denied" as const);
    const state: NavigationState = {
      pointId: point.id,
      outcome,
      time: this.#deps.now().toISOString(),
      revision: this.#revision,
    };
    await this.#deps.kv.compareAndSet({
      key: NAVIGATION_KEY,
      expected: selection,
      value: JSON.stringify(state),
    });
    return state;
  }
}
