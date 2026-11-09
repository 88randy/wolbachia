import { ApiError } from "@wolbachia/api-client";
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
  LifecycleAdmission,
  LifecycleCompletion,
} from "./types.ts";
import { relocationSuggestion } from "./thresholds.ts";
import { readCachedAdvisory } from "./advisory.ts";
import type { AdvisoryView } from "./advisory.ts";
/** A denied interactive read carries only its ORIGINAL request completion. */
export class LifecycleReadDenied extends ApiError {
  readonly completion: LifecycleCompletion;
  constructor(error: ApiError, completion: LifecycleCompletion) {
    super(error.status, error.envelope);
    this.completion = completion;
  }
}
export interface Snapshot extends StoredLifecycle {
  readonly completion?: LifecycleCompletion;
  readonly isScopeBlocked: boolean;
  readonly isShiftBlocked: boolean;
  readonly catalogChanged: boolean;
  readonly canStartCapture: boolean;
  readonly gate: string | null;
  readonly suggestion: { readonly closedHouseWeeks: number } | null;
  readonly advisory: AdvisoryView | null;
  readonly limits?: import("@wolbachia/api-client").Schemas["MeLimits"] | null;
  readonly frameState?: "open" | "closed" | "unknown";
  readonly correctionReasons?: readonly import("../shift-open/domain.ts").ChecklistItem[];
}
type AdmittedTurn = LifecycleSourceTurn & { readonly admission: LifecycleAdmission };
type Action<T extends Snapshot> = (
  state: StoredLifecycle,
  turn: AdmittedTurn,
  operation: LifecycleSourceOperation,
) => Promise<T>;
interface UiCompletionInput {
  readonly turn: LifecycleSourceTurn;
  readonly operation: LifecycleSourceOperation;
  readonly eventId: string | null;
  readonly revision: number;
  readonly isAdmitted: boolean;
  readonly isViewCurrent: () => boolean;
  readonly onSuccess?: () => void;
}
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
  #interaction = 0;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  cancelInteraction(): void {
    this.#interaction++;
    this.#deps.cancelNative?.();
  }
  #write<T extends Snapshot>(
    eventId: string | null,
    action: Action<T>,
    request?: LifecycleSourceRequest | null,
  ): Promise<T> {
    const revision = this.draftBuffer.revision;
    const interaction = this.#interaction;
    const operation = this.#deps.source?.capture(
      eventId,
      () => this.draftBuffer.revision === revision,
      () => this.#interaction === interaction,
    );
    const next = this.#tail.then(async () => {
      if (!operation) throw new LifecycleGateError("scope");
      const stored = await this.#deps.store.read(); // Internal identity lookup, never permission or display.
      assertIdentity(stored, eventId);
      return operation.read(request === undefined ? requestFor(stored) : request, (turn) =>
        this.#execute({ eventId, action, request, turn, operation }),
      );
    });
    this.#tail = next.catch(() => undefined);
    return next;
  }
  async #execute<T extends Snapshot>(input: {
    eventId: string | null;
    action: Action<T>;
    request?: LifecycleSourceRequest | null;
    turn: LifecycleSourceTurn;
    operation: LifecycleSourceOperation;
  }): Promise<T> {
    const { eventId, action, request, turn, operation } = input;
    const state = await this.#deps.store.readOwned(turn);
    if (state.recovery) throw new LifecycleGateError("scope");
    assertIdentity(state, eventId);
    if (request !== null) await this.#authorize(request ? null : state.draft);
    assertIdentity(await this.#deps.store.read(), eventId);
    const admission = this.#admission(turn, operation);
    admission.assertCurrent();
    return this.#perform(action, state, { ...turn, admission, operation });
  }
  async #perform<T extends Snapshot>(
    action: Action<T>,
    state: StoredLifecycle,
    turn: AdmittedTurn & { readonly operation: LifecycleSourceOperation },
  ): Promise<T> {
    try {
      const result = await action(state, turn, turn.operation);
      turn.admission.assertCurrent();
      return {
        ...result,
        completion: this.#completion(turn, turn.operation, result.draft?.eventId ?? null),
      };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 403) throw error;
      throw new LifecycleReadDenied(
        error,
        this.#completion(turn, turn.operation, state.draft?.eventId ?? null),
      );
    }
  }
  #admission(turn: LifecycleSourceTurn, operation: LifecycleSourceOperation): LifecycleAdmission {
    const assertCurrent = () => {
      if (!operation.isCurrent() || !turn.handle.isCurrent()) throw new StaleCaptureError();
    };
    return {
      assertCurrent,
      commit: (sqlOnly) =>
        operation.admit(turn, async () => {
          await this.#deps.store.db.runAtomically(
            lifecycleCommitGuards(turn.handle, turn.ownerFence),
          );
          assertCurrent();
          return sqlOnly();
        }),
    };
  }
  #completion(
    turn: LifecycleSourceTurn,
    operation: LifecycleSourceOperation,
    eventId: string | null,
  ): LifecycleCompletion {
    let revision = this.draftBuffer.revision;
    const isAdmitted = operation.isCurrent() && turn.handle.isCurrent();
    return {
      normalize: (before, observed) => {
        if (
          isAdmitted &&
          before === revision &&
          observed === eventId &&
          operation.isInteractiveCurrent() &&
          turn.handle.isCurrent()
        )
          revision = this.draftBuffer.revision;
      },
      complete: (isViewCurrent, onSuccess) =>
        this.#completeUi({
          turn,
          operation,
          eventId,
          revision,
          isAdmitted,
          isViewCurrent,
          onSuccess,
        }),
    };
  }
  async #completeUi(input: UiCompletionInput): Promise<boolean> {
    if (!input.isAdmitted) return false;
    try {
      await input.turn.assertCurrent();
      const [row] = await this.#deps.store.db.query(
        "SELECT json_extract(draft,'$.eventId') AS id FROM lifecycle_draft WHERE slot=1",
      );
      if (!this.#canCompleteUi(input, row?.id ?? null)) return false;
      input.onSuccess?.();
      return true;
    } catch (error) {
      if (
        error instanceof LifecycleGateError ||
        error instanceof RemoteSessionEnded ||
        error instanceof StaleCaptureError
      )
        return false;
      throw error;
    }
  }
  #canCompleteUi(input: UiCompletionInput, id: unknown): boolean {
    return (
      id === input.eventId &&
      this.draftBuffer.revision === input.revision &&
      input.operation.isInteractiveCurrent() &&
      input.turn.handle.isCurrent() &&
      input.isViewCurrent()
    );
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
    const advisory =
      state.draft?.schemaVersion === 2 && state.draft.kind === "relocate"
        ? await readCachedAdvisory(this.#deps.store.db, state.draft, turn)
        : state.draft
          ? await relocationSuggestion(this.#deps.store.db, state.draft)
          : null;
    const isScopeBlocked = await this.#scopeBlocked(state, turn);
    const frameState = state.draft
      ? await this.#deps.store.frameState(state.draft.point.id, turn)
      : "unknown";
    if (!(await readTurnIsCurrent(turn))) return this.#snapshot(null);
    return snapshotModel({
      state,
      config,
      shiftId,
      advisory,
      isScopeBlocked,
      canCapture: turn?.canCapture === true,
      limits: config.limits ?? null,
      frameState,
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
      const revision = this.draftBuffer.revision;
      this.draftBuffer.rebind(snapshot.draft?.eventId ?? null);
      snapshot.completion?.normalize(revision, snapshot.draft?.eventId ?? null);
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
      const evidence = await (this.#deps.captureEvidence
        ? this.#deps.captureEvidence(draft.eventId, turn.admission)
        : this.#deps.evidence.capture());
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
  openTask(eventId: string | null): Promise<Snapshot> {
    return this.#write(
      eventId,
      async (state, turn) => {
        const task = state.proposal?.nextDayTask;
        if (!state.draft || !task || !state.proposal.isTaskActionable || !this.#deps.selectTask)
          throw new LifecycleGateError("scope");
        await this.#deps.selectTask(
          task.id,
          {
            courier: turn.handle.owner.userId,
            pointId: state.draft.point.id,
          },
          turn.admission,
        );
        return this.#snapshot(turn);
      },
      null,
    );
  }
  refreshAdvisory(eventId: string | null): Promise<Snapshot> {
    return this.#write(eventId, async (state, turn, operation) => {
      if (state.draft) await this.#deps.refreshAdvisory?.(state.draft, turn, operation);
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
      const bindings = (await this.#deps.evidenceBindings?.(draft, turn)) ?? [];
      await operation.admit(turn, () =>
        this.#deps.engine.enqueue(lifecycleEvent(draft), [
          ...lifecycleCommitGuards(turn.handle, turn.ownerFence),
          ...this.#deps.store.commitStatements(draft),
          ...bindings,
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
        proposal: state.proposal,
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
  advisory: Awaited<ReturnType<typeof relocationSuggestion>> | AdvisoryView;
  isScopeBlocked: boolean;
  canCapture: boolean;
  now: Date;
  limits?: import("@wolbachia/api-client").Schemas["MeLimits"] | null;
  frameState: "open" | "closed" | "unknown";
}
function advisoryView(value: SnapshotInput["advisory"]) {
  return {
    suggestion:
      value && "closedHouseWeeks" in value && typeof value.closedHouseWeeks === "number"
        ? { closedHouseWeeks: value.closedHouseWeeks }
        : null,
    advisory: value?.state === "available" || value?.state === "unavailable" ? value : null,
  };
}
function snapshotModel(input: SnapshotInput): Snapshot {
  const { state, shiftId } = input;
  return {
    ...state,
    limits: input.limits ?? null,
    frameState: input.frameState,
    correctionReasons: input.config.catalog?.voidReasons ?? [],
    canStartCapture: Boolean(shiftId && input.canCapture && !state.recovery),
    gate: state.draft ? saveGate(state.draft, input.now) : "draft",
    isScopeBlocked: input.isScopeBlocked,
    isShiftBlocked: !shiftId || Boolean(state.draft && state.draft.shiftId !== shiftId),
    catalogChanged: configurationChanged(state.draft, input.config),
    ...advisoryView(input.advisory),
  };
}
