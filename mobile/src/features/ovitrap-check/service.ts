import { assertCaptureIdentity, ConcurrentCaptureError } from "./capture-identity.ts";
import { ImmutableCaptureError, OvitrapDraftBuffer } from "./draft-buffer.ts";
import { ShiftBlockedError } from "./shift-authorization.ts";
import type { CaptureShiftAuthorization } from "./shift-authorization.ts";
import { availability } from "./availability.ts";
import { correctionDraft } from "./correction.ts";
import { assertSameTarget, normalizeGps, bagIdentity, CatalogChangedError } from "./ports.ts";
import { eventInsertStatement } from "../../outbox/outbox-repository.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import { normalizePaddle, parseQr, UUID_PATTERN } from "./domain.ts";
import { captureEvent, voidEvent } from "./events.ts";
import { newDraft } from "./new-draft.ts";
import { findPoolLabel, normalizeLabelCode } from "./label-pool.ts";
import type { PoolLabel } from "./label-pool.ts";
import type { OvitrapStore, StoredCapture } from "./store.ts";
import type {
  Draft,
  DraftPatch,
  CapturedEvidencePort,
  GpsPort,
  ScannerPort,
  Reuse,
} from "./types.ts";
import { saveGate } from "./validation.ts";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import type { SqlStatement } from "../../db/sql.ts";
import { EvidenceError } from "../../attachments/types.ts";
import type { EvidenceCaptureContext } from "./types.ts";
import { requireCaptureSignal } from "../../attachments/capture-signal.ts";
interface Dependencies {
  readonly store: OvitrapStore;
  readonly engine: SyncEngine;
  readonly now: () => Date;
  readonly uuid: () => string;
  readonly gps: GpsPort;
  readonly scanner: ScannerPort;
  readonly evidence: CapturedEvidencePort;
  readonly evidenceBindings?: (draft: Draft) => Promise<readonly SqlStatement[]>;
  readonly shiftId: () => Promise<string>;
  readonly evidenceShift: () => Promise<CaptureShiftAuthorization>;
  readonly refresh?: () => Promise<void>;
  /** The downloaded pool of unplaced labels; lets a typed `OVT-0001` resolve without a network. */
  readonly labelPool?: () => Promise<readonly PoolLabel[]>;
  /** Builds the assignment from the local day bundle and publishes it; never touches the network. */
  readonly publishAssignment?: () => Promise<void>;
}
interface StartInput {
  readonly mode: Draft["mode"];
  readonly eventId: string | null;
  readonly ovitrapId?: string;
  readonly isManual?: boolean;
}
interface EvidenceContextState {
  readonly draft: Draft;
  readonly signal: AbortSignal;
  readonly assignment: string;
  readonly target: string;
}
function evidenceTarget(draft: Draft | null): string {
  return JSON.stringify(
    draft && [
      draft.eventId,
      draft.mode,
      draft.ovitrapId,
      draft.shiftId,
      draft.point,
      draft.assignment,
    ],
  );
}
export interface Snapshot extends StoredCapture {
  readonly lifecycleTargetId: string | null;
  readonly catalogChanged: boolean;
  readonly isScopeBlocked: boolean;
  readonly isShiftBlocked: boolean;
  readonly canStartCapture: boolean;
  readonly repeat: OutboxEvent | null;
  readonly reuse: readonly Reuse[];
  readonly isBagReserved: boolean;
}
/** Every command carries the displayed UUID; validate it inside the writer and on its loaded draft. */
function labelId(value: string, isManual: boolean): string | null {
  const code = value.trim();
  if (isManual && UUID_PATTERN.test(code)) return code.toLowerCase();
  return parseQr(code, "ovitrap")?.id ?? null;
}
/** Outcome of scanning the label of a trap being placed. */
export type LabelResult = "read" | "invalid" | "used" | "unknown" | "cancelled";
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
    const current = await this.#deps.store.read();
    assertCaptureIdentity(current, eventId);
    if (current.event || !current.draft) throw new ImmutableCaptureError();
    throw new ConcurrentCaptureError();
  }
  async #updateDraft(draft: Draft, version: string | null): Promise<void> {
    await this.#assertUpdated(await this.#deps.store.update(draft, version), draft.eventId);
  }
  async read(): Promise<Snapshot> {
    const state = await this.#deps.store.read();
    const shiftId = await this.#deps.shiftId();
    const scope = await this.#scope(state.draft);
    return {
      ...state,
      canStartCapture: Boolean(shiftId),
      lifecycleTargetId: state.draft
        ? await this.#deps.store.lifecycleTargetId(state.draft.ovitrapId)
        : null,
      isShiftBlocked: !shiftId || Boolean(state.draft && state.draft.shiftId !== shiftId),
      ...scope,
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
  async #scope(draft: Draft | null) {
    return availability(draft, await this.#deps.store.snapshots());
  }
  /**
   * Every entry point (route, tile, scan) first makes the stored assignment current, and an unsent,
   * unplaced draft takes it. It acts on the stored draft, so it needs no displayed identity.
   */
  async syncAssignment(): Promise<void> {
    try {
      await this.#deps.publishAssignment?.();
    } catch {
      return; // The reason is recorded for the on-screen code; the phone copy stays as it was.
    }
    const stored = await this.#deps.store.read();
    if (stored.draft && !stored.event)
      await this.#adoptCurrentAssignment(stored.draft, stored.draftVersion);
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
  async #syncedCapture(eventId: string | null): Promise<StoredCapture> {
    await this.syncAssignment();
    const current = await this.#deps.store.read();
    assertCaptureIdentity(current, eventId);
    return current;
  }
  async #start(input: StartInput): Promise<Snapshot> {
    const { mode, ovitrapId, isManual = false, eventId } = input;
    const current = await this.#syncedCapture(eventId);
    const shiftId = await this.#deps.shiftId();
    if (!shiftId) throw new ShiftBlockedError();
    const pending = await this.#pendingTarget(current, shiftId);
    if (pending) {
      assertSameTarget(pending, mode, ovitrapId);
      await this.#adoptCurrentAssignment(pending, current.draftVersion);
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
  /** A new trap not yet placed keeps no stale copy: it takes the route's current points. */
  async #adoptCurrentAssignment(draft: Draft, version: string | null): Promise<void> {
    if (draft.mode !== "place" || draft.point !== null) return;
    const { assignment } = await this.#deps.store.snapshots();
    if (assignment === null || JSON.stringify(assignment) === JSON.stringify(draft.assignment))
      return;
    await this.#updateDraft({ ...draft, assignment }, version);
  }
  async #pendingTarget(current: StoredCapture, shiftId: string): Promise<Draft | null> {
    if (!current.draft || current.draft.shiftId !== shiftId || current.event) return null;
    const source = await this.#deps.store.lifecycleSource(
      current.draft.ovitrapId,
      current.draft.point,
    );
    return source.isRetired ? null : current.draft;
  }
  async #locateDraft(draft: Draft, isManual: boolean): Promise<Draft> {
    const source = await this.#deps.store.projection(draft.ovitrapId);
    const lifecycle = await this.#deps.store.lifecycleSource(draft.ovitrapId, draft.point);
    if (lifecycle.isRetired) throw new Error("The physical ovitrap is retired.");
    const point =
      lifecycle.physical?.point ??
      source?.point ??
      draft.assignment?.ovitraps.find((item) => item.id === draft.ovitrapId)?.point ??
      null;
    return {
      ...draft,
      point,
      sourceEvidence: [...captureSourceEvidence(source), ...lifecycle.evidence],
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
        state.draftVersion,
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
        const { draft, event, draftVersion } = await this.#readExpected(eventId);
        if (!draft || event) return "cancelled";
        const bagCode = draft.assignment?.bags.find((bag) => bag.id === parsed.id)?.code ?? "";
        await this.#updateDraft(
          {
            ...draft,
            bagUuid: parsed.id,
            bagCode,
            bagQrHistory: [...new Set([...draft.bagQrHistory, parsed.id])],
          },
          draftVersion,
        );
        return "read";
      },
      eventId,
      target === "ovitrap",
    );
  }
  /** Placing: the scanned label UUID becomes the new ovitrap identity (the backend creates it from `ovitrap_id`). */
  bindLabel(value: string, isManual: boolean, eventId: string | null): Promise<LabelResult> {
    return this.#write(async () => {
      const { draft, event, draftVersion } = await this.#readExpected(eventId);
      if (!draft || event || draft.mode !== "place") return "cancelled";
      const identity = await this.#labelIdentity(value, isManual);
      if ("failure" in identity) return identity.failure;
      const { id } = identity;
      if (await this.#isIdentityTaken(id, draft)) return "used";
      await this.#updateDraft(
        {
          ...draft,
          ovitrapId: id,
          labelScanned: true,
          manualCapture: draft.manualCapture || isManual,
        },
        draftVersion,
      );
      return "read";
    }, eventId);
  }
  /** The point code where a label is already placed, for the message; null when unknown. */
  async usedPointCode(
    value: string,
    isManual: boolean,
    eventId: string | null,
  ): Promise<string | null> {
    try {
      const { draft } = await this.#readExpected(eventId);
      const identity = await this.#labelIdentity(value, isManual);
      const id = "id" in identity ? identity.id : null;
      if (!draft || !id) return null;
      return draft.assignment?.ovitraps.find((item) => item.id === id)?.point.code ?? null;
    } catch {
      return null;
    }
  }
  /** A typed short code resolves through the downloaded pool, then takes the same path as a scan. */
  async #labelIdentity(
    value: string,
    isManual: boolean,
  ): Promise<{ readonly id: string } | { readonly failure: "invalid" | "unknown" }> {
    if (isManual && normalizeLabelCode(value) !== null) {
      const label = findPoolLabel((await this.#deps.labelPool?.()) ?? [], value);
      return label ? { id: label.id } : { failure: "unknown" };
    }
    const id = labelId(value, isManual);
    return id ? { id } : { failure: "invalid" };
  }
  async #isIdentityTaken(id: string, draft: Draft): Promise<boolean> {
    if (id === draft.ovitrapId && draft.labelScanned) return false;
    const { store } = this.#deps;
    if (draft.assignment?.ovitraps.some((item) => item.id === id)) return true;
    if ((await store.projection(id)) !== null) return true;
    return (await store.lifecycleSource(id)).physical !== null;
  }
  enterBag(value: string, eventId: string | null, isManual = true): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event, draftVersion } = await this.#readExpected(eventId);
      if (!draft || event) return this.read();
      const { assignment } = await this.#deps.store.snapshots();
      await this.#updateDraft(
        {
          ...draft,
          ...bagIdentity(value, { ...draft, assignment }),
          manualCapture: draft.manualCapture || isManual,
        },
        draftVersion,
      );
      return this.read();
    }, eventId);
  }
  captureEvidence(eventId: string | null, signal = new AbortController().signal): Promise<boolean> {
    return this.#write(async () => {
      const initial = await this.#readExpected(eventId);
      if (!initial.draft || initial.event) return false;
      const context = await this.#evidenceContext(initial.draft, signal);
      await context.assertCurrent();
      const evidence = await this.#deps.evidence.capture(context);
      await context.assertCurrent();
      if (!evidence) return false;
      const isApplied = await this.#deps.store.publishEvidence({
        captured: evidence,
        guard: context.publicationGuard,
      });
      if (!isApplied) throw new EvidenceError("stale_context");
      return true;
    }, eventId);
  }
  async #evidenceContext(
    draft: Draft,
    signal: AbortSignal,
  ): Promise<EvidenceCaptureContext & { publicationGuard: SqlStatement }> {
    const shift = await this.#deps.evidenceShift();
    if (shift.id !== draft.shiftId) throw new ShiftBlockedError();
    const snapshots = await this.#deps.store.snapshots();
    const original = {
      draft,
      signal,
      assignment: JSON.stringify(snapshots.assignment),
      target: evidenceTarget(draft),
    };
    return {
      draftId: draft.eventId,
      signal,
      publicationGuard: this.#deps.store.evidencePublicationGuard({
        draft,
        assignment: snapshots.assignment,
        shift: shift.guard,
      }),
      assertCurrent: () => this.#assertEvidenceContext(original),
    };
  }
  async #assertEvidenceContext(original: EvidenceContextState): Promise<void> {
    requireCaptureSignal(original.signal);
    const current = await this.#deps.store.read();
    assertCaptureIdentity(current, original.draft.eventId);
    if (current.event) throw new ImmutableCaptureError();
    if (await this.#isShiftBlocked(current.draft)) throw new ShiftBlockedError();
    const snapshots = await this.#deps.store.snapshots();
    if (
      availability(current.draft, snapshots).isScopeBlocked ||
      JSON.stringify(snapshots.assignment) !== original.assignment ||
      evidenceTarget(current.draft) !== original.target
    )
      throw new EvidenceError("stale_context");
    requireCaptureSignal(original.signal);
  }
  undoEvidence(eventId: string | null, evidenceId: string): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event, draftVersion } = await this.#readExpected(eventId);
      if (event) throw new ImmutableCaptureError();
      if (draft)
        await this.#updateDraft(
          {
            ...draft,
            evidence: draft.evidence.filter((item) => item.id !== evidenceId),
          },
          draftVersion,
        );
      return this.read();
    }, eventId);
  }
  refreshGps(eventId: string | null): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event, draftVersion } = await this.#readExpected(eventId);
      if (draft && !event)
        await this.#updateDraft(
          {
            ...draft,
            gps: normalizeGps(await this.#deps.gps.locate()),
            reviewAcknowledged: false,
          },
          draftVersion,
        );
      return this.read();
    }, eventId);
  }
  /** Explicitly adopt downloaded snapshots; already captured records keep their historical labels/tokens. */
  adoptSnapshots(eventId: string | null): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event, draftVersion } = await this.#readExpected(eventId);
      if (!draft || event) return this.read();
      const snapshots = await this.#deps.store.snapshots();
      if (draft.finding && !snapshots.catalog?.findings.some((item) => item.code === draft.finding))
        throw new CatalogChangedError();
      if (
        draft.paddleType &&
        !snapshots.catalog?.paddleTypes.some((item) => item.code === draft.paddleType)
      )
        throw new CatalogChangedError();
      await this.#updateDraft(
        {
          ...draft,
          ...snapshots,
          shiftId: draft.shiftId || (await this.#deps.shiftId()),
          reviewAcknowledged: false,
        },
        draftVersion,
      );
      return this.read();
    }, eventId);
  }
  correct(eventId: string | null): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, repeat, draftVersion } = await this.#readExpected(eventId);
      if (!draft || !repeat) return this.read();
      const source = await this.#deps.store.capturedDraft(repeat.envelope.id);
      if (!source) throw new Error("Original reading is unavailable.");
      await this.#updateDraft(correctionDraft(draft, source, this.#deps.uuid()), draftVersion);
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
      await this.#commit(draft, state.draftVersion);
      return this.read();
    }, eventId);
  }
  async #commit(draft: Draft, version: string | null): Promise<void> {
    if (await this.#isShiftBlocked(draft)) throw new ShiftBlockedError();
    const source = await this.#deps.store.lifecycleSource(draft.ovitrapId, draft.point);
    if (source.isRetired) throw new Error("The physical ovitrap is retired.");
    const event = captureEvent(draft);
    const statements = [
      ...this.#deps.store.commitStatements(draft, version),
      ...((await this.#deps.evidenceBindings?.(draft)) ?? []),
    ];
    if (!draft.replacesEventId) return this.#deps.engine.enqueue(event, statements);
    await this.#deps.engine.enqueue(voidEvent(draft), [
      eventInsertStatement(event, draft.deviceTime),
      ...statements,
    ]);
  }
}

function captureSourceEvidence(source: Draft | null): Draft["evidence"] {
  return source ? [...source.sourceEvidence, ...source.evidence] : [];
}
