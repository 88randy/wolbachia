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

interface Dependencies {
  readonly db: SqlExecutor;
  readonly now: () => Date;
  readonly uuid: () => string;
  readonly identity: () => string | null;
  readonly admission?: () => string | null;
  readonly localDate?: (instant: string) => string | null;
  readonly canReconcile?: () => boolean;
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
  constructor(deps: Dependencies) { this.#deps = deps; this.#store = new ShiftCloseStore(deps.db); }
  #write<Result>(action: (assertCurrent: () => void) => Promise<Result>): Promise<Result> {
    const owner = this.#deps.identity();
    const admission = this.#deps.admission === undefined ? owner : this.#deps.admission();
    const assertCurrent = () => {
      this.#requireOwner(owner);
      if (admission === null || (this.#deps.admission === undefined ? owner : this.#deps.admission()) !== admission) throw new Error("Closing admission changed.");
    };
    const next = this.#tail.then(() => this.#deps.serialize(async () => {
      assertCurrent();
      return action(assertCurrent);
    }));
    this.#tail = next.catch(() => undefined);
    return next;
  }
  #requireOwner(owner: string | null): asserts owner is string {
    if (owner === null || this.#deps.identity() !== owner) throw new Error("Closing session changed.");
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
    const pending = draft?.locallyClosedAt ? draft.pending : await this.#deps.pending();
    this.#requireOwner(owner);
    return { draft, opening, events, history, pending, canReconcile: this.#deps.canReconcile?.() ?? true, reasons: snapshots.catalog?.voidReasons ?? [] };
  }
  start() {
    return this.#write(async (assertCurrent) => {
      const state = await this.read();
      if (state.draft !== null) return state;
      const shiftId = state.opening?.envelope.shift_id;
      if (!shiftId) throw new Error("No local shift exists.");
      const ownerKey = this.#deps.identity();
      this.#requireOwner(ownerKey);
      const pending = await this.#deps.pending();
      this.#requireOwner(ownerKey);
      const supplies = (await this.#store.supplies(shiftId, this.#deps.localDate?.(state.opening!.envelope.device_time) ?? null)).map((source) => ({ source, eventId: this.#deps.uuid(), returns: [] }));
      assertCurrent();
      await this.#store.create({ supplies, shiftId, ownerKey, closeEventId: this.#deps.uuid(), odometer: "", note: "", pending, dispositions: {}, locallyClosedAt: null });
      return this.read();
    });
  }
  update(patch: ClosePatch) {
    return this.#write(async (assertCurrent) => {
      const { draft } = await this.read();
      if (draft === null || draft.locallyClosedAt !== null) throw new Error("Closing draft is unavailable.");
      assertCurrent();
      this.#requireOwner(draft.ownerKey);
      await this.#deps.db.runAtomically([this.#store.replace(draft, applyClosePatch(draft, patch))]);
      return this.read();
    });
  }
  refreshSupplies() {
    return this.#write(async (assertCurrent) => {
      const state = await this.read();
      if (!state.draft || state.draft.locallyClosedAt) return state;
      const date = state.opening ? this.#deps.localDate?.(state.opening.envelope.device_time) ?? null : null;
      const sources = await this.#store.supplies(state.draft.shiftId, date);
      const additions = sources.filter((source) => !state.draft?.supplies.some((supply) => supply.source.id === source.id))
        .map((source) => ({ source, eventId: this.#deps.uuid(), returns: [] }));
      assertCurrent();
      if (additions.length) await this.#deps.db.runAtomically([this.#store.replace(state.draft, { ...state.draft, supplies: [...state.draft.supplies, ...additions] })]);
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
      for (const supply of state.draft.supplies) {
        if (supply.shrinkage?.some((line) => Number(line.quantity) !== 0 && !state.reasons.some((reason) => reason.code === line.reasonCode))) throw new Error("Current shrinkage reason is unavailable.");
      }
      const closed = { ...state.draft, pending, locallyClosedAt: this.#deps.now().toISOString() };
      const event = await this.#event(closed);
      assertCurrent();
      this.#requireOwner(closed.ownerKey);
      const reconciliations = reconciliationEvents(closed, event);
      if (reconciliations.length && !state.canReconcile) throw new Error("Current reconciliation permission is unavailable.");
      const events = [...reconciliations, event];
      const bindings = await this.#bindings(closed, events);
      assertCurrent();
      await this.#deps.db.runAtomically([...events.map((source) => eventInsertStatement(source, source.device_time)), ...bindings, this.#store.replace(state.draft, closed, reconciliations.length ? this.#store.sourceGuard(reconciliations.map((source) => String(source.payload.assignment_id))) : undefined)]);
      this.#deps.notify();
      return this.read();
    });
  }
  async #bindings(draft: CloseDraft, events: readonly FieldEventEnvelope[]) {
    const attachments = this.#deps.attachments;
    if (!attachments) return [];
    const fence = await attachments.session.capture();
    return draft.supplies.filter((supply) => events.some((event) => event.id === supply.eventId)).flatMap((supply) => attachments.store.bindingStatements({ eventId: supply.eventId, evidenceIds: supply.photos?.map((photo) => photo.id) ?? [], fence }));
  }
  async capturePhoto(eventId: string, signal: AbortSignal): Promise<void> {
    const admission = this.#deps.admission === undefined ? this.#deps.identity() : this.#deps.admission();
    const { draft } = await this.read();
    const { attachments, photos } = this.#deps;
    if (!draft || draft.locallyClosedAt || !attachments || !photos || !draft.supplies.some((supply) => supply.eventId === eventId)) throw new Error("Closing photo unavailable.");
    const assertCurrent = () => {
      this.#requireOwner(draft.ownerKey);
      if (admission === null || (this.#deps.admission === undefined ? this.#deps.identity() : this.#deps.admission()) !== admission) throw new Error("Closing admission changed.");
    };
    await captureClosePhoto({ store: this.#store, draft, eventId, attachments, port: photos, signal, assertCurrent });
  }
  async #event(draft: CloseDraft): Promise<FieldEventEnvelope> {
    const kv = new KvStore(this.#deps.db);
    const rules = await kv.get("shift_open_rules");
    const catalog = await kv.get("shift_open_catalog");
    const snapshots = await new OvitrapStore(this.#deps.db).snapshots();
    return {
      id: draft.closeEventId, type: "shift.close", schema_version: 1,
      shift_id: draft.shiftId, device_time: draft.locallyClosedAt ?? this.#deps.now().toISOString(),
      gps: null, manual_capture: true, voids_event_id: null,
      rules_version: snapshots.rules?.version ?? (rules === null ? "" : (JSON.parse(rules) as { version: string }).version),
      catalog_version: snapshots.catalog?.version ?? (catalog === null ? "" : (JSON.parse(catalog) as { version: string }).version),
      payload: { odometer_km: Number(draft.odometer), ...(draft.note.trim() ? { note: draft.note.trim() } : {}) },
    };
  }
}
export type CloseSnapshot = Awaited<ReturnType<ShiftCloseService["read"]>>;
