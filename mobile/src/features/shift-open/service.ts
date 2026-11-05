import type { FieldEventEnvelope, OutboxEvent } from "../../outbox/outbox-event.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import { departureGate, UNAVAILABLE_MAP } from "./domain.ts";
import type {
  ChecklistCatalog,
  Gate,
  MapPreparation,
  MapPreparationSource,
  OpenShiftDraft,
  PhotoCapturePort,
} from "./domain.ts";
import type { ShiftOpenStore, StoredShift } from "./store.ts";

interface ServiceDeps {
  readonly store: ShiftOpenStore;
  readonly engine: SyncEngine;
  readonly now: () => Date;
  readonly uuid: () => string;
  readonly maps: MapPreparationSource;
  readonly photos: PhotoCapturePort;
  readonly refreshCatalog?: () => Promise<void>;
}
export interface ShiftSnapshot extends StoredShift {
  readonly catalog: ChecklistCatalog | null;
  readonly map: MapPreparation | null;
  readonly gate: Gate | null;
  readonly canDepart: boolean;
  readonly hasOdometerWarning: boolean;
  readonly lastOdometer: number | null;
}
function outcomeGate(opening: OutboxEvent | null, gate: Gate | null): Gate | null {
  if (opening?.status === "rejected") return "rejected";
  if (opening?.result?.code === "severe_check") return "severe";
  return gate;
}
/** One serialized writer for start/edit/commit prevents duplicate drafts and lost keystrokes. DB slot + event UUID arbitrate across instances. */
export class ShiftOpenService {
  readonly #deps: ServiceDeps;
  readonly #listeners = new Set<() => void>();
  #tail: Promise<unknown> = Promise.resolve();
  constructor(deps: ServiceDeps) {
    this.#deps = deps;
  }
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  async #saveMap(map: MapPreparation): Promise<void> {
    await this.#deps.store.saveMap(map);
    for (const listener of this.#listeners) listener();
  }
  #write<T>(action: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(action);
    this.#tail = next.catch(() => undefined); // Caller receives rejection; later writes must still run.
    return next;
  }
  async read(): Promise<ShiftSnapshot> {
    const { store } = this.#deps;
    const state = await store.read();
    const catalog = await store.catalog();
    const map = await store.map();
    const lastOdometer =
      state.draft === null ? null : await store.lastOdometer(state.draft.motorcycle_code);
    const gate = outcomeGate(
      state.opening,
      state.draft === null ? null : departureGate({ draft: state.draft, catalog, map }),
    );
    return {
      ...state,
      catalog,
      map,
      gate,
      lastOdometer,
      canDepart: state.opening !== null && gate === null,
      hasOdometerWarning:
        lastOdometer !== null &&
        state.draft !== null &&
        Number(state.draft.odometer_km) < lastOdometer,
    };
  }
  start(): Promise<ShiftSnapshot> {
    return this.#write(async () => {
      const state = await this.#deps.store.read();
      if (state.draft === null) await this.#deps.store.createDraft(await this.#newDraft());
      return this.read();
    });
  }
  /** Only an explicit correction of a server rejection may replace the current slot. */
  restartRejected(): Promise<ShiftSnapshot> {
    return this.#write(async () => {
      const { opening } = await this.#deps.store.read();
      if (opening?.status !== "rejected") return this.read();
      await this.#deps.store.replaceRejectedDraft(await this.#newDraft(), opening.envelope.id);
      return this.read();
    });
  }
  async #newDraft(): Promise<OpenShiftDraft> {
    const catalog = await this.#deps.store.catalog();
    return {
      clientShiftId: this.#deps.uuid(),
      openingEventId: this.#deps.uuid(),
      catalogVersion: catalog?.version ?? "",
      motorcycle_code: "",
      checks: [],
      odometer_km: "",
      photoRefs: [],
      note: "",
      step: "motorcycle",
    };
  }
  update(
    patch: Partial<
      Pick<
        OpenShiftDraft,
        "motorcycle_code" | "checks" | "odometer_km" | "photoRefs" | "note" | "step"
      >
    >,
  ): Promise<ShiftSnapshot> {
    return this.#write(async () => {
      const state = await this.#deps.store.read();
      if (state.draft === null) throw new Error("No shift draft exists.");
      if (state.opening !== null) return this.read();
      const hasChangedMotorcycle =
        patch.motorcycle_code !== undefined &&
        patch.motorcycle_code !== state.draft.motorcycle_code;
      const reset = hasChangedMotorcycle ? { checks: [], photoRefs: [] } : {};
      await this.#deps.store.saveDraft({ ...state.draft, ...patch, ...reset });
      return this.read();
    });
  }
  refreshCatalog(): Promise<void> {
    return this.#deps.refreshCatalog?.() ?? Promise.resolve();
  }
  prepareMap(): Promise<ShiftSnapshot> {
    return this.#write(async () => {
      const { store, maps } = this.#deps;
      const previous = await store.map();
      await this.#saveMap({ ...(previous ?? UNAVAILABLE_MAP), status: "preparing", error: null });
      let map: MapPreparation;
      try {
        map = await maps.prepare((progress) => this.#saveMap(progress), previous);
      } catch {
        map = {
          ...((await store.map()) ?? UNAVAILABLE_MAP),
          status: "failed",
          error: "preparation_failed",
        };
      }
      await this.#saveMap(map);
      return this.read();
    });
  }
  capturePhoto(): Promise<string> {
    return this.#write(async () => {
      const photo = await this.#deps.photos.capture();
      if (photo.status !== "captured") return photo.status;
      const { draft, opening } = await this.#deps.store.read();
      if (draft === null || opening !== null) return "cancelled";
      await this.#deps.store.saveDraft({
        ...draft,
        photoRefs: [...draft.photoRefs, photo.fileRef],
      });
      return "captured";
    });
  }
  /** Reconfirm against the new catalog explicitly; old severe evidence is retained until the courier edits it. */
  confirmCatalog(): Promise<ShiftSnapshot> {
    return this.#write(async () => {
      const { draft, opening } = await this.#deps.store.read();
      const catalog = await this.#deps.store.catalog();
      if (draft === null || opening !== null || catalog === null) return this.read();
      const hasRetiredChecks = draft.checks.some(
        (check) => !catalog.items.some((item) => item.code === check.item),
      );
      if (hasRetiredChecks)
        throw new Error("Captured checklist evidence requires supervisor review; catalog changed.");
      await this.#deps.store.saveDraft({ ...draft, catalogVersion: catalog.version });
      return this.read();
    });
  }
  open(): Promise<ShiftSnapshot> {
    return this.#write(async () => {
      const state = await this.read();
      if (state.opening !== null) return state;
      if (state.draft === null) throw new Error("No shift draft exists.");
      if (state.gate !== null && state.gate !== "severe")
        throw new Error(`Departure blocked: ${state.gate}`);
      const event = await this.#event(state.draft, state.catalog);
      await this.#deps.engine.enqueue(event, this.#deps.store.openStatements(state.draft));
      return this.read();
    });
  }
  async #event(
    draft: OpenShiftDraft,
    catalog: ChecklistCatalog | null,
  ): Promise<FieldEventEnvelope> {
    return {
      id: draft.openingEventId,
      type: "shift.open",
      schema_version: 1,
      device_time: this.#deps.now().toISOString(),
      shift_id: draft.clientShiftId,
      gps: null,
      manual_capture: true,
      voids_event_id: null,
      rules_version: await this.#deps.store.rulesVersion(),
      catalog_version: catalog?.version ?? "",
      payload: {
        motorcycle_code: draft.motorcycle_code.trim(),
        odometer_km: Number(draft.odometer_km),
        checks: draft.checks,
        ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      },
    };
  }
}
