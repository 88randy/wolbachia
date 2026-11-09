import { OvitrapStore } from "../ovitrap-check/store.ts";
import { captureClosePhoto } from "./photo.ts";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { KvStore } from "../../db/kv-store.ts";
import type { SqlExecutor } from "../../db/sql.ts";
import { eventInsertStatement } from "../../outbox/outbox-repository.ts";
import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import { reconciliationEvents } from "./reconciliation.ts";
import { ShiftCloseStore } from "./store.ts";
import { applyClosePatch, validateClose } from "./domain.ts";
import type { CloseDraft, ClosePatch, PendingPoint } from "./domain.ts";
import { readSupplySource } from "./supplies.ts";
import { SupplyProjectionUnavailable } from "../supply-receipt/projection-types.ts";
import type { SupplyProjectionSource } from "../supply-receipt/projection-types.ts";

interface Dependencies {
  readonly db: SqlExecutor;
  readonly now: () => Date;
  readonly uuid: () => string;
  readonly identity: () => string | null;
  readonly admission?: () => string | null;
  readonly localDate?: (instant: string) => string | null;
  readonly canReconcile?: () => boolean;
  readonly supplySource?: () => Promise<SupplyProjectionSource>;
  readonly pending: () => Promise<readonly PendingPoint[]>;
  readonly serialize: <Result>(write: () => Promise<Result>) => Promise<Result>;
  readonly notify: () => void;
  readonly attachments?: Attachments;
  readonly photos?: EvidencePort;
}
/** One writer serializes draft edits and close; original JSON CAS arbitrates other instances. */
export class ShiftCloseService {
  readonly #deps: Dependencies;
  readonly #store: ShiftCloseStore;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(deps: Dependencies) {
    this.#deps = deps;
    this.#store = new ShiftCloseStore(deps.db);
  }
  #write<Result>(action: (assertCurrent: () => void) => Promise<Result>): Promise<Result> {
    const owner = this.#deps.identity();
    const admission = this.#deps.admission === undefined ? owner : this.#deps.admission();
    const assertCurrent = () => {
      this.#requireOwner(owner);
      if (
        admission === null ||
        (this.#deps.admission === undefined ? owner : this.#deps.admission()) !== admission
      )
        throw new Error("Closing admission changed.");
    };
    const next = this.#tail.then(() =>
      this.#deps.serialize(async () => {
        assertCurrent();
        return action(assertCurrent);
      }),
    );
    this.#tail = next.catch(() => undefined);
    return next;
  }
  #requireOwner(owner: string | null): asserts owner is string {
    if (owner === null || this.#deps.identity() !== owner)
      throw new Error("Closing session changed.");
  }
  async read() {
    const owner = this.#deps.identity();
    this.#requireOwner(owner);
    const opening = await this.#store.opening();
    const shiftId = opening?.envelope.shift_id ?? "";
    const draft = await this.#store.read(shiftId);
    if (draft !== null && draft.ownerKey !== owner) throw new Error("Closing owner changed.");
    const events = await this.#store.events(shiftId);
    const history = await this.#store.history(shiftId);
    this.#requireOwner(owner);
    const snapshots = await new OvitrapStore(this.#deps.db).snapshots();
    this.#requireOwner(owner);
    const pending = await this.#pendingPoints(draft);
    this.#requireOwner(owner);
    return {
      draft,
      opening,
      events,
      history,
      pending,
      canReconcile: this.#deps.canReconcile?.() ?? true,
      reasons: snapshots.catalog?.voidReasons ?? [],
    };
  }
  #pendingPoints(draft: CloseDraft | null): Promise<readonly PendingPoint[]> {
    return draft?.locallyClosedAt ? Promise.resolve(draft.pending) : this.#deps.pending();
  }
  async #suppliesFor(opening: FieldEventEnvelope) {
    const projection = await this.#supplyProjection();
    const date = this.#deps.localDate?.(opening.device_time) ?? null;
    const supplies = (projection?.assignments ?? [])
      .filter(
        (source) =>
          source.shift_id === opening.shift_id ||
          (source.shift_id === null && source.date === date),
      )
      .map((source) => ({
        source: readSupplySource(source),
        eventId: this.#deps.uuid(),
        returns: [],
      }));
    return { supplies, guard: supplies.length ? projection?.guard : undefined };
  }
  async #supplyProjection(): Promise<SupplyProjectionSource | null> {
    try {
      return (await this.#deps.supplySource?.()) ?? null;
    } catch (error) {
      if (!(error instanceof SupplyProjectionUnavailable)) throw error;
      return null;
    }
  }
  start() {
    return this.#write(async (assertCurrent) => {
      const state = await this.read();
      if (state.draft !== null) return state;
      const opening = state.opening;
      const shiftId = opening?.envelope.shift_id;
      if (!shiftId) throw new Error("No local shift exists.");
      const ownerKey = this.#deps.identity();
      this.#requireOwner(ownerKey);
      const pending = await this.#deps.pending();
      this.#requireOwner(ownerKey);
      const { supplies, guard } = await this.#suppliesFor(opening.envelope);
      assertCurrent();
      await this.#store.create(
        {
          supplies,
          shiftId,
          ownerKey,
          closeEventId: this.#deps.uuid(),
          odometer: "",
          note: "",
          pending,
          dispositions: {},
          locallyClosedAt: null,
        },
        guard,
      );
      return this.read();
    });
  }
  update(patch: ClosePatch) {
    return this.#write(async (assertCurrent) => {
      const { draft } = await this.read();
      if (draft === null || draft.locallyClosedAt !== null)
        throw new Error("Closing draft is unavailable.");
      assertCurrent();
      this.#requireOwner(draft.ownerKey);
      await this.#deps.db.runAtomically([
        this.#store.replace(draft, applyClosePatch(draft, patch)),
      ]);
      return this.read();
    });
  }
  refreshSupplies() {
    return this.#write(async (assertCurrent) => {
      const state = await this.read();
      if (!state.draft || state.draft.locallyClosedAt) return state;
      if (!state.opening) return state;
      const { supplies, guard } = await this.#suppliesFor(state.opening.envelope);
      const additions = supplies.filter(
        (source) => !state.draft?.supplies.some((supply) => supply.source.id === source.source.id),
      );
      assertCurrent();
      if (additions.length)
        await this.#deps.db.runAtomically([
          this.#store.replace(
            state.draft,
            {
              ...state.draft,
              supplies: [...state.draft.supplies, ...additions],
            },
            guard,
          ),
        ]);
      return this.read();
    });
  }
  close() {
    return this.#write(async (assertCurrent) => {
      const state = await this.read();
      if (state.draft?.locallyClosedAt) return state;
      if (!state.draft) throw new Error("No closing draft exists.");
      const pending = await this.#deps.pending();
      validateClose(state.draft, pending);
      this.#validateShrinkageReasons(state);
      const closed = { ...state.draft, pending, locallyClosedAt: this.#deps.now().toISOString() };
      const event = await this.#event(closed);
      assertCurrent();
      this.#requireOwner(closed.ownerKey);
      const reconciliations = reconciliationEvents(closed, event);
      if (reconciliations.length && !state.canReconcile)
        throw new Error("Current reconciliation permission is unavailable.");
      await this.#commitClose({
        original: state.draft,
        closed,
        reconciliations,
        event,
        assertCurrent,
      });
      this.#deps.notify();
      return this.read();
    });
  }
  #validateShrinkageReasons(state: CloseSnapshot): void {
    for (const supply of state.draft?.supplies ?? []) {
      if (
        supply.shrinkage?.some(
          (line) =>
            Number(line.quantity) !== 0 &&
            !state.reasons.some((reason) => reason.code === line.reasonCode),
        )
      )
        throw new Error("Current shrinkage reason is unavailable.");
    }
  }
  async #commitClose(input: {
    readonly original: CloseDraft;
    readonly closed: CloseDraft;
    readonly reconciliations: readonly FieldEventEnvelope[];
    readonly event: FieldEventEnvelope;
    readonly assertCurrent: () => void;
  }): Promise<void> {
    const { original, closed, reconciliations, event, assertCurrent } = input;
    const events = [...reconciliations, event];
    const bindings = await this.#bindings(closed, events);
    const sourceGuard = reconciliations.length
      ? await this.#supplyGuard(reconciliations.map((event) => String(event.payload.assignment_id)))
      : undefined;
    assertCurrent();
    await this.#deps.db.runAtomically([
      ...events.map((source) => eventInsertStatement(source, source.device_time)),
      ...bindings,
      this.#store.replace(original, closed, sourceGuard),
    ]);
  }
  async #supplyGuard(ids: readonly string[]) {
    const projection = await this.#supplyProjection();
    if (
      projection === null ||
      ids.some((id) => !projection.assignments.some((source) => source.id === id))
    )
      throw new SupplyProjectionUnavailable("Current reconciliation supply source unavailable.");
    return projection.guard;
  }
  async #bindings(draft: CloseDraft, events: readonly FieldEventEnvelope[]) {
    const attachments = this.#deps.attachments;
    if (!attachments) return [];
    const fence = await attachments.session.capture();
    return draft.supplies
      .filter((supply) => events.some((event) => event.id === supply.eventId))
      .flatMap((supply) =>
        attachments.store.bindingStatements({
          eventId: supply.eventId,
          evidenceIds: supply.photos?.map((photo) => photo.id) ?? [],
          fence,
        }),
      );
  }
  async capturePhoto(eventId: string, signal: AbortSignal): Promise<void> {
    const admission =
      this.#deps.admission === undefined ? this.#deps.identity() : this.#deps.admission();
    const { draft } = await this.read();
    const { attachments, photos } = this.#deps;
    const supply = draft?.supplies.find((supply) => supply.eventId === eventId);
    if (!draft || draft.locallyClosedAt || !attachments || !photos || !supply)
      throw new Error("Closing photo unavailable.");
    const assertCurrent = this.#photoGuard(draft, admission);
    const sourceGuard = await this.#supplyGuard([supply.source.id]);
    assertCurrent();
    await captureClosePhoto({
      store: this.#store,
      draft,
      eventId,
      attachments,
      port: photos,
      signal,
      assertCurrent,
      sourceGuard,
    });
  }
  #photoGuard(draft: CloseDraft, admission: string | null): () => void {
    return () => {
      this.#requireOwner(draft.ownerKey);
      if (
        admission === null ||
        (this.#deps.admission === undefined ? this.#deps.identity() : this.#deps.admission()) !==
          admission
      )
        throw new Error("Closing admission changed.");
    };
  }
  async #event(draft: CloseDraft): Promise<FieldEventEnvelope> {
    const kv = new KvStore(this.#deps.db);
    const rules = await kv.get("shift_open_rules");
    const catalog = await kv.get("shift_open_catalog");
    const snapshots = await new OvitrapStore(this.#deps.db).snapshots();
    return {
      id: draft.closeEventId,
      type: "shift.close",
      schema_version: 1,
      shift_id: draft.shiftId,
      device_time: draft.locallyClosedAt ?? this.#deps.now().toISOString(),
      gps: null,
      manual_capture: true,
      voids_event_id: null,
      rules_version:
        snapshots.rules?.version ??
        (rules === null ? "" : (JSON.parse(rules) as { version: string }).version),
      catalog_version:
        snapshots.catalog?.version ??
        (catalog === null ? "" : (JSON.parse(catalog) as { version: string }).version),
      payload: {
        odometer_km: Number(draft.odometer),
        ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      },
    };
  }
}
export type CloseSnapshot = Awaited<ReturnType<ShiftCloseService["read"]>>;
