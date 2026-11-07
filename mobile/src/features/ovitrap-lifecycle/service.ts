import { EvidenceUnavailableError, LifecycleGateError } from "./action-error-key.ts";
import { ShiftBlockedError } from "../ovitrap-check/shift-authorization.ts";
import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import { normalizeGps, CatalogChangedError } from "../ovitrap-check/ports.ts";
import { assertIdentity, editable, StaleCaptureError } from "./capture-identity.ts";
import { LifecycleDraftBuffer } from "./draft-buffer.ts";
import { saveGate, MAX_EVIDENCE } from "./domain.ts";
import { lifecycleEvent } from "./events.ts";
import { commitCorrection } from "./correction.ts";
import type { Correction } from "./events.ts";
import { startDraft, pendingDraft } from "./new-draft.ts";
import { startOwnedLifecycleDraft, lifecycleCommitGuards } from "./new-owned-draft.ts";
import type { StartInput } from "./new-draft.ts";
import type { Dependencies } from "./ports.ts";
import type {
  DraftPatch,
  LifecycleDraft,
  StoredLifecycle,
  LifecycleSourceTurn,
  LifecycleSourceOperation,
  LifecycleSourceRequest,
} from "./types.ts";
import { relocationSuggestion } from "./thresholds.ts";
export interface Snapshot extends StoredLifecycle {
  readonly isScopeBlocked: boolean;
  readonly isShiftBlocked: boolean;
  readonly catalogChanged: boolean;
  readonly canStartCapture: boolean;
  readonly gate: string | null;
  readonly suggestion: { readonly closedHouseWeeks: number } | null;
  readonly advisory: {
    readonly state: "unavailable";
    readonly reason: "advisory_not_loaded";
  } | null;
}
type Action<T> = (
  state: StoredLifecycle,
  turn: LifecycleSourceTurn,
  operation: LifecycleSourceOperation,
) => Promise<T>;
function requestFor(state: StoredLifecycle): LifecycleSourceRequest | null {
  if (!state.draft) return null;
  return state.event
    ? { kind: "correction", sourceEventId: state.draft.eventId }
    : { kind: "new", ovitrapId: state.draft.ovitrapId };
}
/** One service queue; slow work runs outside credentials/projection/network gates. */
export class LifecycleService {
  readonly draftBuffer = new LifecycleDraftBuffer();
  readonly #deps: Dependencies;
  #tail: Promise<unknown> = Promise.resolve();
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  #write<T>(
    eventId: string | null,
    action: Action<T>,
    request?: LifecycleSourceRequest,
  ): Promise<T> {
    const revision = this.draftBuffer.revision;
    const operation = this.#deps.source?.capture(
      eventId,
      () => this.draftBuffer.revision === revision,
    );
    const next = this.#tail.then(async () => {
      if (!operation) throw new LifecycleGateError("scope");
      const stored = await this.#deps.store.read(); // Internal identity lookup, never permission or display.
      assertIdentity(stored, eventId);
      return operation.read(request ?? requestFor(stored), async (turn) => {
        const state = await this.#deps.store.readOwned(turn);
        if (state.recovery) throw new LifecycleGateError("scope");
        assertIdentity(state, eventId);
        await this.#authorize(request ? null : state.draft);
        assertIdentity(await this.#deps.store.read(), eventId);
        if (!operation.isCurrent()) throw new StaleCaptureError();
        const result = await action(state, turn, operation);
        if (!operation.isCurrent()) throw new StaleCaptureError();
        return result;
      });
    });
    this.#tail = next.catch(() => undefined);
    return next;
  }
  async #authorize(draft: LifecycleDraft | null): Promise<void> {
    const shiftId = await this.#deps.shiftId();
    if (!shiftId || (draft && shiftId !== draft.shiftId)) throw new ShiftBlockedError();
  }
  async #scopeBlocked(state: StoredLifecycle, turn: LifecycleSourceTurn | null) {
    if (!turn || state.recovery) return true;
    const request = requestFor(state);
    if (request === null) return false;
    try {
      await turn.resolve(request);
      return false;
    } catch (error) {
      if (error instanceof LifecycleGateError) return true;
      throw error;
    }
  }
  async #snapshot(turn: LifecycleSourceTurn | null): Promise<Snapshot> {
    const state = await this.#deps.store.readOwned(turn);
    const config = turn
      ? await this.#deps.store.configuration(turn.handle)
      : { catalog: null, rules: null };
    const shiftId = await this.#deps.shiftId();
    const advisory = state.draft
      ? await relocationSuggestion(this.#deps.store.db, state.draft)
      : null;
    const isScopeBlocked = await this.#scopeBlocked(state, turn);
    if (!(await readTurnIsCurrent(turn))) return this.#snapshot(null);
    return snapshotModel({
      state,
      config,
      shiftId,
      advisory,
      isScopeBlocked,
      canCapture: turn?.canCapture === true,
      now: this.#deps.now(),
    });
  }
  async read(): Promise<Snapshot> {
    if (!this.#deps.source) return this.#snapshot(null);
    try {
      return await this.#deps.source.read(null, (turn) => this.#snapshot(turn));
    } catch (error) {
      if (error instanceof LifecycleGateError || error instanceof RemoteSessionEnded)
        return this.#snapshot(null);
      throw error;
    }
  }
  start(input: StartInput, eventId: string | null): Promise<Snapshot> {
    const deviceTime = this.#deps.now().toISOString();
    return this.#write(
      eventId,
      async (state, turn, operation) => {
        const shiftId = await this.#deps.shiftId();
        if (!shiftId) throw new ShiftBlockedError();
        if (pendingDraft(state, input, shiftId)) return this.#snapshot(turn);
        if (!turn.source) throw new LifecycleGateError("scope");
        const source = turn.source;
        await startOwnedLifecycleDraft({
          store: this.#deps.store,
          handle: turn.handle,
          ownerFence: turn.ownerFence,
          expectedEventId: eventId,
          uuid: this.#deps.uuid,
          admit: (commit) => operation.admit(turn, commit),
          create: (id) =>
            startDraft(this.#deps, { ...input, source, freshEventId: id, deviceTime }),
        });
        return this.#snapshot(turn);
      },
      { kind: "new", ovitrapId: input.ovitrapId },
    ).then((snapshot) => {
      this.draftBuffer.rebind(snapshot.draft?.eventId ?? null);
      return snapshot;
    });
  }
  async #persist(
    draft: LifecycleDraft,
    turn: LifecycleSourceTurn,
    operation: LifecycleSourceOperation,
  ): Promise<void> {
    await this.#authorize(draft);
    assertIdentity(await this.#deps.store.read(), draft.eventId);
    await operation.admit(turn, () => this.#deps.store.update(draft, turn));
  }
  update(
    patch: DraftPatch,
    eventId: string | null,
  ): Promise<Snapshot & { isUpdateApplied: boolean }> {
    return this.#write(eventId, async (state, turn, operation) => {
      await this.#persist({ ...editable(state), ...patch }, turn, operation);
      return { ...(await this.#snapshot(turn)), isUpdateApplied: true };
    });
  }
  refreshGps(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state, turn, operation) => {
      const draft = editable(state);
      const gps = normalizeGps(await this.#deps.gps.locate());
      await this.#persist(
        {
          ...draft,
          gps,
          proposedLocation: draft.kind === "relocate" && gps ? [gps.lng, gps.lat] : null,
          reviewAcknowledged: false,
        },
        turn,
        operation,
      );
      return this.#snapshot(turn);
    });
  }
  captureEvidence(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state, turn, operation) => {
      const draft = editable(state);
      if (draft.evidence.length >= MAX_EVIDENCE) throw new Error("Evidence limit reached.");
      const evidence = await this.#deps.evidence.capture();
      if (!evidence) throw new EvidenceUnavailableError();
      await this.#persist(
        {
          ...draft,
          evidence: [...draft.evidence.filter((item) => item.id !== evidence.id), evidence],
        },
        turn,
        operation,
      );
      return this.#snapshot(turn);
    });
  }
  removeEvidence(id: string, eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state, turn, operation) => {
      const draft = editable(state),
        removed = draft.evidence.find((item) => item.id === id);
      if (removed)
        await this.#persist(
          {
            ...draft,
            evidence: draft.evidence.filter((item) => item.id !== id),
            discardedEvidence: [...draft.discardedEvidence, removed],
          },
          turn,
          operation,
        );
      return this.#snapshot(turn);
    });
  }
  undoEvidence(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state, turn, operation) => {
      const draft = editable(state),
        evidence = draft.discardedEvidence.at(-1);
      if (evidence)
        await this.#persist(
          {
            ...draft,
            evidence: [...draft.evidence, evidence],
            discardedEvidence: draft.discardedEvidence.slice(0, -1),
          },
          turn,
          operation,
        );
      return this.#snapshot(turn);
    });
  }
  refresh(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (_state, turn, operation) => {
      await this.#deps.refresh?.(turn, operation);
      return this.#snapshot(turn);
    });
  }
  adoptSnapshots(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state, turn, operation) => {
      const draft = editable(state),
        config = await this.#deps.store.configuration(turn.handle);
      if (
        draft.reasonCode &&
        !config.catalog?.[draft.kind].some((item) => item.code === draft.reasonCode)
      )
        throw new CatalogChangedError();
      await this.#persist({ ...draft, ...config, reviewAcknowledged: false }, turn, operation);
      return this.#snapshot(turn);
    });
  }
  save(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state, turn, operation) => {
      if (state.event) return this.#snapshot(turn);
      const draft = editable(state),
        gate = saveGate(draft, this.#deps.now());
      if (gate || !turn.source || turn.source.isRetired)
        throw new LifecycleGateError(gate ?? "scope");
      await this.#authorize(draft);
      await operation.admit(turn, () =>
        this.#deps.engine.enqueue(lifecycleEvent(draft), [
          ...lifecycleCommitGuards(turn.handle, turn.ownerFence),
          ...this.#deps.store.commitStatements(draft),
        ]),
      );
      return this.#snapshot(turn);
    });
  }
  correct(correction: Correction, eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state, turn, operation) => {
      if (!state.draft || !state.event) throw new LifecycleGateError("scope");
      const engine: Dependencies["engine"] = {
        enqueue: (event, statements) =>
          operation.admit(turn, () =>
            this.#deps.engine.enqueue(event, [
              ...lifecycleCommitGuards(turn.handle, turn.ownerFence),
              ...(statements ?? []),
            ]),
          ),
      };
      await commitCorrection({ ...this.#deps, engine }, state.draft, {
        ...correction,
        configuration: await this.#deps.store.configuration(turn.handle),
      });
      return this.#snapshot(turn);
    });
  }
}
function configurationChanged(
  draft: LifecycleDraft | null,
  config: import("./types.ts").Configuration,
): boolean {
  return Boolean(
    draft &&
    (!draft.catalog ||
      !draft.rules ||
      draft.catalog.version !== config.catalog?.version ||
      draft.rules.version !== config.rules?.version),
  );
}

async function readTurnIsCurrent(turn: LifecycleSourceTurn | null): Promise<boolean> {
  if (turn === null) return true;
  try {
    await turn.assertCurrent();
    return true;
  } catch (error) {
    if (error instanceof LifecycleGateError || error instanceof RemoteSessionEnded) return false;
    throw error;
  }
}
interface SnapshotInput {
  state: StoredLifecycle;
  config: import("./types.ts").Configuration;
  shiftId: string;
  advisory: Awaited<ReturnType<typeof relocationSuggestion>>;
  isScopeBlocked: boolean;
  canCapture: boolean;
  now: Date;
}
function advisoryView(value: SnapshotInput["advisory"]) {
  return {
    suggestion:
      typeof value?.closedHouseWeeks === "number"
        ? { closedHouseWeeks: value.closedHouseWeeks }
        : null,
    advisory: value?.state === "unavailable" ? { state: value.state, reason: value.reason } : null,
  };
}
function snapshotModel(input: SnapshotInput): Snapshot {
  const { state, shiftId } = input;
  return {
    ...state,
    canStartCapture: Boolean(shiftId && input.canCapture && !state.recovery),
    gate: state.draft ? saveGate(state.draft, input.now) : "draft",
    isScopeBlocked: input.isScopeBlocked,
    isShiftBlocked: !shiftId || Boolean(state.draft && state.draft.shiftId !== shiftId),
    catalogChanged: configurationChanged(state.draft, input.config),
    ...advisoryView(input.advisory),
  };
}
