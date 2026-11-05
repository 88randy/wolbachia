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
export interface Snapshot extends StoredCapture {
  readonly catalogChanged: boolean;
  readonly isScopeBlocked: boolean;
  readonly repeat: OutboxEvent | null;
  readonly reuse: readonly Reuse[];
  readonly isBagReserved: boolean;
}
/** Serialize start/edit/commit. SQL slot/capture constraints protect against a second service instance. */
export class OvitrapService {
  readonly #deps: Dependencies;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  #write<T>(action: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(action);
    this.#tail = next.catch(() => undefined); // Caller owns the rejection; future writes remain possible.
    return next;
  }
  async read(): Promise<Snapshot> {
    const state = await this.#deps.store.read();
    return {
      ...state,
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
  refresh(): Promise<void> {
    return this.#deps.refresh?.() ?? Promise.resolve();
  }
  startPlace(): Promise<Snapshot> {
    return this.#write(() => this.#start("place"));
  }
  startCheck(code: string, isManual: boolean): Promise<Snapshot> {
    return this.#write(async () => {
      const parsed = parseQr(code, "ovitrap");
      const id =
        parsed?.id ??
        (isManual && UUID_PATTERN.test(code.trim()) ? code.trim().toLowerCase() : null);
      if (!id) throw new Error("Invalid ovitrap code.");
      return this.#start("check", id, isManual);
    });
  }
  async #start(mode: Draft["mode"], ovitrapId?: string, isManual = false): Promise<Snapshot> {
    const current = await this.#deps.store.read();
    if (current.draft && !current.event) {
      assertSameTarget(current.draft, mode, ovitrapId);
      return this.read();
    }
    const { store, uuid, now } = this.#deps;
    const draft = newDraft({
      uuid,
      now: now(),
      mode,
      ovitrapId,
      shiftId: await this.#deps.shiftId(),
      snapshots: await store.snapshots(),
    });
    await store.begin(await this.#locateDraft(draft, isManual));
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
  update(patch: DraftPatch): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event } = await this.read();
      if (!draft || event) return this.read();
      const manual = patch.bagCode !== undefined ? { manualCapture: true, bagUuid: null } : {};
      await this.#deps.store.update(normalizePaddle({ ...draft, ...patch, ...manual }));
      return this.read();
    });
  }
  scan(target: "bag" | "ovitrap"): Promise<string> {
    return this.#write(async () => {
      const result = await this.#deps.scanner.scan();
      if (result.status !== "read") return result.status;
      const parsed = parseQr(result.value, target);
      if (!parsed) return "invalid";
      if (target === "ovitrap") {
        await this.#start("check", parsed.id);
        return "read";
      }
      const { draft, event } = await this.read();
      if (!draft || event) return "cancelled";
      const bagCode = draft.assignment?.bags.find((bag) => bag.id === parsed.id)?.code ?? "";
      await this.#deps.store.update({
        ...draft,
        bagUuid: parsed.id,
        bagCode,
        bagQrHistory: [...new Set([...draft.bagQrHistory, parsed.id])],
      });
      return "read";
    });
  }
  enterBag(value: string): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event } = await this.read();
      if (!draft || event) return this.read();
      await this.#deps.store.update({
        ...draft,
        ...bagIdentity(value, draft),
        manualCapture: true,
      });
      return this.read();
    });
  }
  captureEvidence(): Promise<boolean> {
    return this.#write(async () => {
      const evidence = await this.#deps.evidence.capture();
      const { draft, event } = await this.read();
      if (!draft || event || !evidence) return false;
      await this.#deps.store.update({
        ...draft,
        evidence: [...draft.evidence.filter((item) => item.id !== evidence.id), evidence],
      });
      return true;
    });
  }
  refreshGps(): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event } = await this.read();
      if (draft && !event)
        await this.#deps.store.update({
          ...draft,
          gps: normalizeGps(await this.#deps.gps.locate()),
          reviewAcknowledged: false,
        });
      return this.read();
    });
  }
  /** Explicitly adopt downloaded snapshots; already captured records keep their historical labels/tokens. */
  adoptSnapshots(): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, event } = await this.read();
      if (!draft || event) return this.read();
      const snapshots = await this.#deps.store.snapshots();
      if (draft.finding && !snapshots.catalog?.findings.some((item) => item.code === draft.finding))
        throw new CatalogChangedError();
      if (
        draft.paddleType &&
        !snapshots.catalog?.paddleTypes.some((item) => item.code === draft.paddleType)
      )
        throw new CatalogChangedError();
      await this.#deps.store.update({
        ...draft,
        ...snapshots,
        shiftId: draft.shiftId || (await this.#deps.shiftId()),
        reviewAcknowledged: false,
      });
      return this.read();
    });
  }
  correct(): Promise<Snapshot> {
    return this.#write(async () => {
      const { draft, repeat } = await this.read();
      if (!draft || !repeat) return this.read();
      const source = await this.#deps.store.capturedDraft(repeat.envelope.id);
      if (!source) throw new Error("Original reading is unavailable.");
      await this.#deps.store.update(correctionDraft(draft, source, this.#deps.uuid()));
      return this.read();
    });
  }
  save(): Promise<Snapshot> {
    return this.#write(async () => {
      const state = await this.read();
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
    });
  }
  async #commit(draft: Draft): Promise<void> {
    const event = captureEvent(draft);
    const statements = this.#deps.store.commitStatements(draft);
    if (!draft.replacesEventId) return this.#deps.engine.enqueue(event, statements);
    await this.#deps.engine.enqueue(voidEvent(draft), [
      eventInsertStatement(event, draft.deviceTime),
      ...statements,
    ]);
  }
}
