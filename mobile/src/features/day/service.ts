import type { LifecycleAdmission } from "../ovitrap-lifecycle/types.ts";
import type { KvStore } from "../../db/kv-store.ts";
import type { NavigationService } from "../../navigation/navigation-service.ts";
import type { ShiftOpenStore } from "../shift-open/store.ts";
import type { MapPreparationSource } from "../shift-open/domain.ts";
import type { DayBundleService, ProjectionWriter } from "./bundle-service.ts";
import type { LocalWorkOverlay } from "./types.ts";
import { maxGpsAccuracy } from "./location.ts";
import type { LocationSource } from "./location.ts";
import type { TaskOwner } from "./current-task.ts";
import { verifyMap } from "./map-coverage.ts";
import type { MapState, MapFileInspector } from "./map-coverage.ts";
interface Dependencies {
  readonly bundle: DayBundleService;
  readonly shift: ShiftOpenStore;
  readonly kv: KvStore;
  readonly work: LocalWorkOverlay;
  readonly navigation: NavigationService;
  readonly location: LocationSource & { stopAll?: () => void };
  readonly maps: MapPreparationSource;
  readonly inspect: MapFileInspector;
  readonly hasOpenShift: () => Promise<boolean>;
}
/** Feature facade; server projection refresh never captures or acknowledges local work. */
export class DayService {
  readonly #deps: Dependencies;
  #map: MapState = { kind: "unavailable" };
  #mapVersion: string | null = null;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  get bundle() {
    return this.#deps.bundle;
  }
  select(pointId: string, expected?: TaskOwner, admission?: LifecycleAdmission): Promise<string> {
    if (expected) {
      if (!admission)
        return Promise.reject(
          new Error("Current task selection requires its original interactive admission."),
        );
      return this.#deps.bundle.withCurrentTask(pointId, expected, {
        admission,
        sqlOnly: () => this.#deps.navigation.select(pointId),
      });
    }
    return this.#deps.bundle.withAssignments((cache) => {
      if (!cache.tasks.some((row) => row.task.id === pointId))
        throw new Error("Point is no longer assigned.");
      return this.#deps.navigation.select(pointId);
    });
  }
  navigate(pointId: string) {
    return this.#deps.bundle.withAssignments((cache) => {
      const row = cache.tasks.find((entry) => entry.task.id === pointId);
      if (row === undefined) throw new Error("Point is no longer assigned.");
      return this.#deps.navigation.launch(row.task);
    });
  }
  clearSelection(): Promise<void> {
    return this.#deps.navigation.clear();
  }
  stopLocation(): void {
    this.#deps.location.stopAll?.();
  }
  get location() {
    return this.#deps.location;
  }
  async read() {
    const [cache, work, navigation, rules, isShiftOpen] = await Promise.all([
      this.#deps.bundle.read(),
      this.#deps.work.read(),
      this.#deps.navigation.read(),
      this.#deps.kv.get("shift_open_rules"),
      this.#deps.hasOpenShift(),
    ]);
    const isCurrent = JSON.stringify(cache.manifests) === this.#mapVersion;
    return {
      ...cache,
      work,
      navigation: cache.meta === null ? null : navigation,
      isShiftOpen,
      maxGpsAccuracyM: maxGpsAccuracy(rules === null ? null : (JSON.parse(rules) as unknown)),
      map:
        isCurrent && cache.meta?.map_manifest_ready ? this.#map : { kind: "unavailable" as const },
    };
  }
  async verifyMap(retry = false): Promise<void> {
    const write = this.#deps.bundle.captureProjectionWriter();
    const cache = await this.#deps.bundle.read();
    const preparation = await this.#prepareMap(retry, write);
    const map = await verifyMap({
      preparation,
      manifests: cache.manifests,
      inspect: this.#deps.inspect,
    });
    await write(() => {
      this.#map = map;
      this.#mapVersion = JSON.stringify(cache.manifests);
      return Promise.resolve();
    });
  }
  async #prepareMap(retry: boolean, write: ProjectionWriter) {
    const preparation = await this.#deps.shift.map();
    if (!retry || preparation?.status === "ready") return preparation;
    const prepared = await this.#deps.maps.prepare(
      (progress) => write(() => this.#deps.shift.saveMap(progress)),
      preparation,
    );
    await write(() => this.#deps.shift.saveMap(prepared));
    return prepared;
  }
}
export type DaySnapshot = Awaited<ReturnType<DayService["read"]>>;
