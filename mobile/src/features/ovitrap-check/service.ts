import { assertCaptureIdentity } from "./capture-identity.ts";
import { ImmutableCaptureError, OvitrapDraftBuffer } from "./draft-buffer.ts";
import { ShiftBlockedError } from "./shift-authorization.ts";
import { availability } from "./availability.ts";
import { correctionDraft } from "./correction.ts";
import { assertSameTarget, normalizeGps, bagIdentity, CatalogChangedError } from "./ports.ts";
import { eventInsertStatement } from "../../outbox/outbox-repository.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import { normalizePaddle, parseQr, UUID_PATTERN } from "./domain.ts";
import { captureEvent, voidEvent } from "./events.ts";
import { newDraft } from "./new-draft.ts";
import type { OvitrapStore, StoredCapture } from "./store.ts";
import type { Draft, DraftPatch, EvidencePort, GpsPort, ScannerPort, Reuse } from "./types.ts";
import { saveGate } from "./validation.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
interface Dependencies {
  readonly store: OvitrapStore;
  readonly engine: SyncEngine;
  readonly now: () => Date;
  readonly uuid: () => string;
  readonly gps: GpsPort;
  readonly scanner: ScannerPort;
  readonly evidence: EvidencePort;
  readonly shiftId: () => Promise<string>;
  readonly refresh?: () => Promise<void>;
}
interface StartInput {
  readonly mode: Draft["mode"];
  readonly eventId: string | null;
  readonly ovitrapId?: string;
  readonly isManual?: boolean;
}
export interface Snapshot extends StoredCapture {
  readonly catalogChanged: boolean;
  readonly isScopeBlocked: boolean;
  readonly isShiftBlocked: boolean;
  readonly canStartCapture: boolean;
  readonly repeat: OutboxEvent | null;
  readonly reuse: readonly Reuse[];
  readonly isBagReserved: boolean;
}
/** Every command carries the displayed UUID; validate it inside the writer and on its loaded draft. */
export class OvitrapService {
  readonly draftBuffer = new OvitrapDraftBuffer();
  readonly #deps: Dependencies;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  #write<T>(action: () => Promise<T>, eventId: string | null, startsCapture = false): Promise<T> {
    const next = this.#tail.then(async () => {
      const state = await this.#deps.store.read();
      assertCaptureIdentity(state, eventId);
      if (await this.#isShiftBlocked(startsCapture ? null : state.draft))
        throw new ShiftBlockedError();
      return action();
    });
    this.#tail = next.catch(() => undefined); // Caller owns the rejection; future writes remain possible.
    return next;
  }
  async #readExpected(eventId: string | null): Promise<Snapshot> {
    const state = await this.read();
    assertCaptureIdentity(state, eventId);
    return state;
  }
  async #assertUpdated(isApplied: boolean, eventId: string | null): Promise<void> {
    if (isApplied) return;
    assertCaptureIdentity(await this.#deps.store.read(), eventId);
    throw new ImmutableCaptureError();
  }
  async #updateDraft(draft: Draft): Promise<void> {
    await this.#assertUpdated(await this.#deps.store.update(draft), draft.eventId);
  }
  async read(): Promise<Snapshot> {
    const state = await this.#deps.store.read();
    const shiftId = await this.#deps.shiftId();
    return {
      ...state,
      canStartCapture: Boolean(shiftId),
      isShiftBlocked: !shiftId || Boolean(state.draft && state.draft.shiftId !== shiftId),
      ...availability(state.draft, await this.#deps.store.snapshots()),
      reuse: state.draft ? await this.#deps.store.reuse(state.draft) : [],
      isBagReserved: Boolean(
        state.draft?.bagCode &&
        !state.event &&
        (await this.#deps.store.isBagReserved(state.draft.bagCode)),
      ),
      repeat: state.draft && !state.event ? await this.#deps.store.repeat(state.draft) : null,
    };
  }
  async #isShiftBlocked(draft: Draft | null): Promise<boolean> {
    const id = await this.#deps.shiftId();
    return !id || Boolean(draft && draft.shiftId !== id);
  }
  async refresh(eventId: string | null): Promise<void> {
    assertCaptureIdentity(await this.#deps.store.read(), eventId);
    await this.#deps.refresh?.();
  }
  startPlace(eventId: string | null): Promise<Snapshot> {
    return this.#write(() => this.#start({ mode: "place", eventId }), eventId, true);
  }
  startCheck(code: string, isManual: boolean, eventId: string | null): Promise<Snapshot> {
    return this.#write(
      async () => {
        const parsed = parseQr(code, "ovitrap");
        const id =
          parsed?.id ??
          (isManual && UUID_PATTERN.test(code.trim()) ? code.trim().toLowerCase() : null);
        if (!id) throw new Error("Invalid ovitrap code.");
        return this.#start({ mode: "check", ovitrapId: id, isManual, eventId });
      },
      eventId,
      true,
    );
  }
  async #start(input: StartInput): Promise<Snapshot> {
    const { mode, ovitrapId, isManual = false, eventId } = input;
    const current = await this.#deps.store.read();
    assertCaptureIdentity(current, eventId);
    const shiftId = await this.#deps.shiftId();
    if (!shiftId) throw new ShiftBlockedError();
    if (current.draft?.shiftId === shiftId && !current.event) {
      assertSameTarget(current.draft, mode, ovitrapId);
      return this.read();
    }
    const { store, uuid, now } = this.#deps;
    const draft = newDraft({
      uuid,
      now: now(),
      mode,
      ovitrapId,
      shiftId,
      snapshots: await store.snapshots(),
    });
    const located = await this.#locateDraft(draft, isManual);
    if (await this.#isShiftBlocked(located)) throw new ShiftBlockedError();
    assertCaptureIdentity(await store.read(), eventId);
    await store.begin(located);
    this.draftBuffer.rebind(located.eventId);
    const saved = await this.read();
    if (saved.draft) assertSameTarget(saved.draft, mode, ovitrapId);
    return saved;
  }
  async #locateDraft(draft: Draft, isManual: boolean): Promise<Draft> {
    const source = await this.#deps.store.projection(draft.ovitrapId);
    const point =
      source?.point ??
      draft.assignment?.ovitraps.find((item) => item.id === draft.ovitrapId)?.point ??
      null;
    return {
      ...draft,
      point,
      sourceEvidence: source ? [...source.sourceEvidence, ...source.evidence] : [],
      gps: normalizeGps(await this.#deps.gps.locate()),
      manualCapture: isManual,
    };
  }
  update(
    patch: DraftPatch,
    eventId: string | null,
  ): Promise<Snapshot & { readonly isUpdateApplied: boolean }> {
    return this.#write(async () => {
      const state = await this.#readExpected(eventId);
      const { draft, event } = state;
      if (!draft || event) return { ...state, isUpdateApplied: false };
      if (state.isShiftBlocked) throw new ShiftBlockedError();
      const manual = patch.bagCode !== undefined ? { manualCapture: true, bagUuid: null } : {};
      const isUpdateApplied = await this.#deps.store.update(
        normalizePaddle({ ...draft, ...patch, ...manual }),
      );
      await this.#assertUpdated(isUpdateApplied, eventId);
      return { ...(await this.read()), isUpdateApplied };
    }, eventId);
  }
  scan(target: "bag" | "ovitrap", eventId: string | null): Promise<string> {
    return this.#write(
      async () => {
        const result = await this.#deps.scanner.scan();
        if (result.status !== "read") return result.status;
        const parsed = parseQr(result.value, target);
        if (!parsed) return "invalid";
        if (target === "ovitrap") {
          await this.#start({ mode: "check", ovitrapId: parsed.id, eventId });
          return "read";
        }
        const { draft, event } = await this.#readExpected(eventId);
        if (!draft || event) return "cancelled";
        const bagCode = draft.assignment?.bags.find((bag) => bag.id === parsed.id)?.code ?? "";
        await this.#updateDraft({
          ...draft,
          bagUuid: parsed.id,
          bagCode,
          bagQrHistory: [...new Set([...draft.bagQrHistory, parsed.id])],
        });
        return "read";
      },
      eventId,
      target === "ovitrap",
    );
  }
  enterBag(value: string, eventId: string | null): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event } = await this.#readExpected(eventId);
      if (!draft || event) return this.read();
      await this.#updateDraft({
        ...draft,
        ...bagIdentity(value, draft),
        manualCapture: true,
      });
      return this.read();
    }, eventId);
  }
  captureEvidence(eventId: string | null): Promise<boolean> {
    return this.#write(async () => {
      const evidence = await this.#deps.evidence.capture();
      const { draft, event } = await this.#readExpected(eventId);
      if (!draft || event || !evidence) return false;
      await this.#updateDraft({
        ...draft,
        evidence: [...draft.evidence.filter((item) => item.id !== evidence.id), evidence],
      });
      return true;
    }, eventId);
  }
  refreshGps(eventId: string | null): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event } = await this.#readExpected(eventId);
      if (draft && !event)
        await this.#updateDraft({
          ...draft,
          gps: normalizeGps(await this.#deps.gps.locate()),
          reviewAcknowledged: false,
        });
      return this.read();
    }, eventId);
  }
  /** Explicitly adopt downloaded snapshots; already captured records keep their historical labels/tokens. */
  adoptSnapshots(eventId: string | null): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event } = await this.#readExpected(eventId);
      if (!draft || event) return this.read();
      const snapshots = await this.#deps.store.snapshots();
      if (draft.finding && !snapshots.catalog?.findings.some((item) => item.code === draft.finding))
        throw new CatalogChangedError();
      if (
        draft.paddleType &&
        !snapshots.catalog?.paddleTypes.some((item) => item.code === draft.paddleType)
      )
        throw new CatalogChangedError();
      await this.#updateDraft({
        ...draft,
        ...snapshots,
        shiftId: draft.shiftId || (await this.#deps.shiftId()),
        reviewAcknowledged: false,
      });
      return this.read();
    }, eventId);
  }
  correct(eventId: string | null): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, repeat } = await this.#readExpected(eventId);
      if (!draft || !repeat) return this.read();
      const source = await this.#deps.store.capturedDraft(repeat.envelope.id);
      if (!source) throw new Error("Original reading is unavailable.");
      await this.#updateDraft(correctionDraft(draft, source, this.#deps.uuid()));
      return this.read();
    }, eventId);
  }
  save(eventId: string | null): Promise<Snapshot> {
    return this.#write(async () => {
      const state = await this.#readExpected(eventId);
      if (state.event) return state;
      if (!state.draft) throw new Error("No capture draft.");
      const draft = normalizePaddle(state.draft);
      const validationDraft = draft.assignment
        ? { ...draft, assignment: { ...draft.assignment, reuse: state.reuse } }
        : draft;
      const gate = saveGate(validationDraft, this.#deps.now());
      if (gate || (state.repeat && draft.replacesEventId !== state.repeat.envelope.id))
        throw new Error(`Capture blocked: ${gate ?? "repeat"}`);
      if (state.isScopeBlocked) throw new Error("Current assignment no longer grants this point.");
      if (state.isBagReserved) throw new Error("Bag code is reserved.");
      await this.#commit(draft);
      return this.read();
    }, eventId);
  }
  async #commit(draft: Draft): Promise<void> {
    if (await this.#isShiftBlocked(draft)) throw new ShiftBlockedError();
    const event = captureEvent(draft);
    const statements = this.#deps.store.commitStatements(draft);
    if (!draft.replacesEventId) return this.#deps.engine.enqueue(event, statements);
    await this.#deps.engine.enqueue(voidEvent(draft), [
      eventInsertStatement(event, draft.deviceTime),
      ...statements,
    ]);
  }
}
