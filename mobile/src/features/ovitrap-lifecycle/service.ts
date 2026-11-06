import { EvidenceUnavailableError, LifecycleGateError } from "./action-error-key.ts";
import { ShiftBlockedError } from "../ovitrap-check/shift-authorization.ts";
import { normalizeGps, CatalogChangedError } from "../ovitrap-check/ports.ts";
import { assertIdentity, editable } from "./capture-identity.ts";
import { LifecycleDraftBuffer } from "./draft-buffer.ts";
import { saveGate, MAX_EVIDENCE } from "./domain.ts";
import { lifecycleEvent } from "./events.ts";
import { commitCorrection } from "./correction.ts";
import type { Correction } from "./events.ts";
import { startDraft } from "./new-draft.ts";
import type { StartInput } from "./new-draft.ts";
import type { Dependencies } from "./ports.ts";
import type { DraftPatch, LifecycleDraft, StoredLifecycle } from "./types.ts";
import { relocationSuggestion } from "./thresholds.ts";
export interface Snapshot extends StoredLifecycle {
  readonly isScopeBlocked: boolean;
  readonly isShiftBlocked: boolean;
  readonly catalogChanged: boolean;
  readonly canStartCapture: boolean;
  readonly gate: string | null;
  readonly suggestion: Awaited<ReturnType<typeof relocationSuggestion>>;
}
/** One writer, displayed UUID before effects, and SQL guards for other service instances. */
export class LifecycleService {
  readonly draftBuffer = new LifecycleDraftBuffer();
  readonly #deps: Dependencies;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  #write<T>(
    eventId: string | null,
    action: (state: StoredLifecycle) => Promise<T>,
    startsDraft = false,
  ): Promise<T> {
    const next = this.#tail.then(async () => {
      const state = await this.#deps.store.read();
      assertIdentity(state, eventId);
      await this.#authorize(startsDraft ? null : state.draft);
      const authorized = await this.#deps.store.read();
      assertIdentity(authorized, eventId);
      return action(authorized);
    });
    this.#tail = next.catch(() => undefined); // Each caller owns its error; the writer remains usable.
    return next;
  }
  async #authorize(draft: LifecycleDraft | null): Promise<void> {
    const shiftId = await this.#deps.shiftId();
    if (!shiftId || (draft && shiftId !== draft.shiftId)) throw new ShiftBlockedError();
  }
  async read(): Promise<Snapshot> {
    const state = await this.#deps.store.read();
    const { assignment } = await this.#deps.store.capture.snapshots();
    const config = await this.#deps.store.configuration();
    const shiftId = await this.#deps.shiftId();
    return {
      ...state,
      canStartCapture: Boolean(shiftId),
      gate: state.draft ? saveGate(state.draft, this.#deps.now()) : "draft",
      isScopeBlocked: Boolean(
        state.draft && !assignment?.points.some((point) => point.id === state.draft?.point.id),
      ),
      isShiftBlocked: !shiftId || Boolean(state.draft && state.draft.shiftId !== shiftId),
      catalogChanged: configurationChanged(state.draft, config),
      suggestion: state.draft ? await relocationSuggestion(this.#deps.store.db, state.draft) : null,
    };
  }
  start(input: StartInput, eventId: string | null): Promise<Snapshot> {
    return this.#write(
      eventId,
      async (state) => {
        const draft = await startDraft(this.#deps, input, state);
        await this.#authorize(draft);
        if (draft.eventId !== state.draft?.eventId) await this.#deps.store.begin(draft, eventId);
        this.draftBuffer.rebind(draft.eventId);
        return this.read();
      },
      true,
    );
  }
  async #persist(draft: LifecycleDraft): Promise<void> {
    await this.#authorize(draft);
    assertIdentity(await this.#deps.store.read(), draft.eventId);
    await this.#deps.store.update(draft);
  }
  update(
    patch: DraftPatch,
    eventId: string | null,
  ): Promise<Snapshot & { isUpdateApplied: boolean }> {
    return this.#write(eventId, async (state) => {
      const draft = editable(state);
      await this.#persist({ ...draft, ...patch });
      return { ...(await this.read()), isUpdateApplied: true };
    });
  }
  refreshGps(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state) => {
      const draft = editable(state);
      const gps = normalizeGps(await this.#deps.gps.locate());
      await this.#persist({
        ...draft,
        gps,
        proposedLocation: draft.kind === "relocate" && gps ? [gps.lng, gps.lat] : null,
        reviewAcknowledged: false,
      });
      return this.read();
    });
  }
  captureEvidence(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state) => {
      const draft = editable(state);
      if (draft.evidence.length >= MAX_EVIDENCE) throw new Error("Evidence limit reached.");
      const evidence = await this.#deps.evidence.capture();
      assertIdentity(await this.#deps.store.read(), eventId);
      if (!evidence) throw new EvidenceUnavailableError();
      await this.#persist({
        ...draft,
        evidence: [...draft.evidence.filter((item) => item.id !== evidence.id), evidence],
      });
      return this.read();
    });
  }
  removeEvidence(id: string, eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state) => {
      const draft = editable(state);
      const removed = draft.evidence.find((item) => item.id === id);
      if (removed)
        await this.#persist({
          ...draft,
          evidence: draft.evidence.filter((item) => item.id !== id),
          discardedEvidence: [...draft.discardedEvidence, removed],
        });
      return this.read();
    });
  }
  undoEvidence(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state) => {
      const draft = editable(state);
      const evidence = draft.discardedEvidence.at(-1);
      if (!evidence) return this.read();
      await this.#persist({
        ...draft,
        evidence: [...draft.evidence, evidence],
        discardedEvidence: draft.discardedEvidence.slice(0, -1),
      });
      return this.read();
    });
  }
  refresh(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async () => {
      await this.#deps.refresh?.();
      assertIdentity(await this.#deps.store.read(), eventId);
      return this.read();
    });
  }
  adoptSnapshots(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state) => {
      const draft = editable(state);
      const config = await this.#deps.store.configuration();
      if (
        draft.reasonCode &&
        !config.catalog?.[draft.kind].some((item) => item.code === draft.reasonCode)
      )
        throw new CatalogChangedError();
      await this.#persist({ ...draft, ...config, reviewAcknowledged: false });
      return this.read();
    });
  }
  save(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state) => {
      if (state.event) return this.read();
      const draft = editable(state);
      const current = await this.read();
      const gate = saveGate(draft, this.#deps.now());
      const physical = await this.#deps.store.physical(draft.ovitrapId);
      if (gate || current.isScopeBlocked || physical?.isRetired !== false)
        throw new LifecycleGateError(gate ?? "scope");
      await this.#authorize(draft);
      await this.#deps.engine.enqueue(
        lifecycleEvent(draft),
        this.#deps.store.commitStatements(draft),
      );
      return this.read();
    });
  }
  correct(correction: Correction, eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state) => {
      if (!state.draft || !state.event || (await this.read()).isScopeBlocked)
        throw new Error("No authorized captured lifecycle.");
      await commitCorrection(this.#deps, state.draft, correction);
      return this.read();
    });
  }
}

function configurationChanged(
  draft: LifecycleDraft | null,
  config: import("./types.ts").Configuration,
): boolean {
  if (!draft) return false;
  return (
    !draft.catalog ||
    !draft.rules ||
    draft.catalog.version !== config.catalog?.version ||
    draft.rules.version !== config.rules?.version
  );
}
