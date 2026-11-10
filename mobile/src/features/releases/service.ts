import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { EvidencePort, GpsPort } from "../ovitrap-check/types.ts";
import { canSaveRelease, cachedReleaseGates, releaseEvent, releaseGates } from "./domain.ts";
import { releaseChoices, releaseCustody, resolveReleasePins } from "./selection-source.ts";
import type { ReleaseProjectionSource } from "./projections.ts";
import { ReleaseProjectionUnavailable } from "./projections.ts";
import { ReleaseError } from "./types.ts";
import type { ReleaseDraft, ReleaseSelection, ReleaseState, ReleasePins } from "./types.ts";
import type { ReleaseStore } from "./store.ts";
import { captureReleasePhoto } from "./capture-photo.ts";
import { activeFeedback } from "../ovitrap-lifecycle/feedback.ts";
import { discardedSources } from "./review-reservations.ts";
import type { Schemas } from "@wolbachia/api-client";

export interface ReleaseShift {
  readonly id: string;
  readonly guard: SqlStatement;
}
interface Dependencies {
  readonly store: ReleaseStore;
  readonly attachments: Attachments;
  readonly bundle: Pick<DayBundleService, "withReleaseProjection" | "subscribe" | "refresh">;
  readonly engine: Pick<SyncEngine, "enqueue">;
  readonly current: () => EvidenceIdentity | null;
  readonly canCapture: () => boolean;
  readonly shift: () => Promise<ReleaseShift>;
  readonly timezone: () => string | null;
  readonly photo: EvidencePort;
  readonly gps: GpsPort;
  readonly uuid: () => string;
  readonly now: () => Date;
}
export interface ReleaseWriteContext {
  readonly draft: ReleaseDraft;
  readonly effective: ReleaseDraft;
  readonly gates: ReleaseState["gates"];
  readonly guards: readonly SqlStatement[];
  readonly fence: EvidenceFence;
  readonly canUpload: boolean;
  readonly captureVersion: string;
}
type StoredRelease = NonNullable<Awaited<ReturnType<ReleaseStore["read"]>>>;
interface WriteRequest {
  readonly id: string;
  readonly identity: EvidenceIdentity;
  readonly sealCapture?: boolean;
}
interface ReadWriteContext extends WriteRequest {
  readonly source: ReleaseProjectionSource;
  readonly stored: StoredRelease;
  readonly shift: ReleaseShift;
  readonly fence: EvidenceFence;
}
interface RestartRequest {
  readonly identity: EvidenceIdentity;
  readonly fence: EvidenceFence;
  readonly stored: StoredRelease;
}
type ReleaseOrigin = Pick<
  ReleaseDraft,
  "ownerKey" | "shiftId" | "deviceTime" | "timezone" | "pins" | "manualCapture"
>;
interface SelectionFrame {
  readonly source: ReleaseProjectionSource;
  readonly selection: ReleaseSelection;
  readonly shiftId: string;
  readonly timezone: string;
  readonly deviceTime: string;
  readonly shift: ReleaseShift;
}
const EMPTY: ReleaseState = {
  draft: null,
  event: null,
  ready: false,
  canRestart: false,
  evidencePending: false,
  review: null,
  tasks: [],
  devices: [],
  gates: cachedReleaseGates({
    permit: null,
    eligibility: null,
    gps: null,
    now: new Date(0),
    isConfigured: false,
  }),
};
function matches(draft: ReleaseDraft, selection: ReleaseSelection): boolean {
  return (
    (!selection.taskId || draft.pins.task.id === selection.taskId) &&
    (!selection.deviceId || draft.pins.device.id === selection.deviceId)
  );
}
function currentPins(source: ReleaseProjectionSource, draft: ReleaseDraft): ReleasePins | null {
  return resolveReleasePins({
    source,
    shiftId: draft.shiftId,
    timezone: draft.timezone,
    deviceTime: draft.deviceTime,
    selection: {
      taskId: draft.pins.task.id,
      deviceId: draft.pins.device.id,
      manualCapture: draft.manualCapture,
    },
  });
}
function changedFrame(draft: ReleaseDraft, fresh: ReleaseDraft): boolean {
  return (
    draft.shiftId !== fresh.shiftId ||
    draft.timezone !== fresh.timezone ||
    draft.pins.captureVersion !== fresh.pins.captureVersion ||
    draft.pins.permit.version !== fresh.pins.permit.version ||
    draft.pins.eligibility.version !== fresh.pins.eligibility.version
  );
}
function safeFreshOrigin(draft: ReleaseDraft, fresh: ReleaseDraft, now: Date): boolean {
  if (!changedFrame(draft, fresh) || fresh.pins.custody.blocked_by.length > 0) return false;
  const staticNames = ["permit", "training", "schedule", "device", "configuration"];
  const gates = releaseGates({
    draft: fresh,
    current: fresh.pins,
    now,
    availableQuantity: fresh.pins.custody.available_quantity,
    taskCaptured: false,
  });
  return gates
    .filter(({ name }) => staticNames.includes(name))
    .every(({ state }) => state === "pass");
}
/** One local edit queue; native I/O stays outside it, guarded by the original source and draft CAS. */
export class ReleaseService {
  readonly deps: Dependencies;
  #tail: Promise<unknown> = Promise.resolve();
  readonly #listeners = new Set<() => void>();
  constructor(deps: Dependencies) {
    this.deps = deps;
  }
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    const stop = this.deps.bundle.subscribe(listener);
    return () => {
      this.#listeners.delete(listener);
      stop();
    };
  };
  #publish(): void {
    for (const listener of this.#listeners) listener();
  }
  #identity(): EvidenceIdentity {
    const identity = this.deps.current();
    if (!identity || !this.deps.canCapture()) throw new ReleaseError("scope");
    return identity;
  }
  assertIdentity = (original: EvidenceIdentity): void => {
    const current = this.deps.current();
    if (
      !current ||
      ownerKey(current.owner) !== ownerKey(original.owner) ||
      current.sessionId !== original.sessionId
    )
      throw new ReleaseError("scope");
  };
  #run<Result>(action: (identity: EvidenceIdentity) => Promise<Result>): Promise<Result> {
    const original = this.#identity();
    const next = this.#tail.then(async () => {
      this.assertIdentity(original);
      if (!this.deps.canCapture()) throw new ReleaseError("scope");
      const result = await action(original);
      this.#publish();
      return result;
    });
    this.#tail = next.catch(() => undefined);
    return next;
  }
  async #selectionSource(
    source: ReleaseProjectionSource,
    selection: ReleaseSelection,
  ): Promise<SelectionFrame> {
    const shift = await this.deps.shift(),
      timezone = this.deps.timezone();
    if (!timezone) throw new ReleaseError("context_unavailable");
    return {
      source,
      selection,
      shiftId: shift.id,
      timezone,
      deviceTime: this.deps.now().toISOString(),
      shift,
    };
  }
  begin(selection: ReleaseSelection): Promise<string> {
    return this.#run(async (identity) => {
      const fence = await this.deps.attachments.session.capture();
      return this.deps.bundle.withReleaseProjection(async (source) => {
        const input = await this.#selectionSource(source, selection),
          pins = resolveReleasePins(input);
        if (!pins) throw new ReleaseError("context_unavailable");
        const existing = (await this.deps.store.list(fence.ownerKey)).find(
          (draft) => matches(draft, selection) && draft.shiftId === input.shift.id,
        );
        if (existing) return existing.eventId;
        const draft = await this.#newDraft({
          ownerKey: fence.ownerKey,
          shiftId: input.shift.id,
          deviceTime: input.deviceTime,
          timezone: input.timezone,
          pins,
          manualCapture: selection.manualCapture,
        });
        this.assertIdentity(identity);
        await this.deps.store.begin(draft, [
          source.guard,
          input.shift.guard,
          { sql: `SELECT 1 WHERE ${CURRENT_FENCE}`, params: fenceParams(fence) },
        ]);
        return draft.eventId;
      });
    });
  }
  async #newDraft(origin: ReleaseOrigin): Promise<ReleaseDraft> {
    const versions = await this.deps.store.versions();
    return {
      ...origin,
      eventId: this.deps.uuid(),
      rulesVersion: versions.rules,
      catalogVersion: versions.catalog,
      trainingVersionId: origin.pins.eligibility.training_version_ids[0] ?? "",
      quantity: "",
      gps: null,
      evidence: [],
    };
  }
  restart(id: string): Promise<string> {
    return this.#run(async (identity) => {
      const fence = await this.deps.attachments.session.capture();
      const stored = await this.deps.store.read(id, fence.ownerKey);
      if (!stored || stored.event || stored.supersededBy) throw new ReleaseError("stale_draft");
      return this.deps.bundle.withReleaseProjection((source) =>
        this.#restartSource({ identity, fence, stored }, source),
      );
    });
  }
  async #restartSource(request: RestartRequest, source: ReleaseProjectionSource): Promise<string> {
    const { identity, fence, stored } = request;
    const selection = {
      taskId: stored.draft.pins.task.id,
      deviceId: stored.draft.pins.device.id,
      manualCapture: stored.draft.manualCapture,
    };
    const frame = await this.#selectionSource(source, selection),
      pins = resolveReleasePins(frame);
    if (stored.draft.shiftId !== frame.shiftId) throw new ReleaseError("stale_draft");
    if (!pins) throw new ReleaseError("context_unavailable");
    const fresh = await this.#renewedDraft(stored.draft, frame, pins);
    const captured = await this.deps.store.taskCaptured(fence.ownerKey, pins.task.id);
    if (captured || !safeFreshOrigin(stored.draft, fresh, this.deps.now()))
      throw new ReleaseError("safety_blocked");
    this.assertIdentity(identity);
    await this.deps.store.restart(stored.draft, fresh, [
      source.guard,
      frame.shift.guard,
      this.deps.store.draftGuard({ id: stored.draft.eventId, raw: stored.raw, fence }),
    ]);
    return fresh.eventId;
  }
  async #renewedDraft(
    original: ReleaseDraft,
    frame: SelectionFrame,
    pins: ReleasePins,
  ): Promise<ReleaseDraft> {
    const fresh = await this.#newDraft({
      ownerKey: original.ownerKey,
      shiftId: frame.shiftId,
      deviceTime: frame.deviceTime,
      timezone: frame.timezone,
      pins,
      manualCapture: original.manualCapture,
    });
    return { ...fresh, quantity: original.quantity };
  }
  async #currentState(source: ReleaseProjectionSource, draft: ReleaseDraft) {
    const current = draft.timezone === this.deps.timezone() ? currentPins(source, draft) : null;
    const reservations = await this.deps.store.reservations(
      draft.ownerKey,
      draft.pins.device.source_lot_id,
    );
    const history = await activeFeedback(this.deps.store.db, source.handle);
    const custody = releaseCustody({
      draft,
      current,
      entries: reservations.entries,
      discardedIds: discardedSources(history),
    });
    const taskCaptured = await this.deps.store.taskCaptured(draft.ownerKey, draft.pins.task.id);
    const gates = releaseGates({ ...custody, now: this.deps.now(), taskCaptured });
    return { ...custody, reservations, gates };
  }
  async #readSource(
    selection: ReleaseSelection,
    stored: Awaited<ReturnType<ReleaseStore["read"]>>,
  ) {
    return this.deps.bundle.withReleaseProjection(async (source) => {
      if (stored?.event) return this.#readSaved(source, stored);
      const input = await this.#selectionSource(source, selection),
        choices = releaseChoices(input);
      if (!stored || stored.draft.shiftId !== input.shift.id) return { ...EMPTY, ...choices };
      const current = await this.#currentState(source, stored.draft);
      const review = await this.#review(source, stored.draft.eventId);
      const evidencePending = await this.deps.store.evidencePending(stored.draft);
      const canRestart = await this.#canRestart(stored.draft, input);
      if (!source.handle.isCurrent()) throw new ReleaseError("scope");
      return {
        ...choices,
        review,
        draft: stored.draft,
        event: stored.event,
        gates: current.gates,
        ready: stored.draft.shiftId === input.shift.id,
        canRestart,
        evidencePending,
      };
    });
  }
  async #canRestart(draft: ReleaseDraft, frame: SelectionFrame): Promise<boolean> {
    if (draft.shiftId !== frame.shiftId) return false;
    const selection = {
      taskId: draft.pins.task.id,
      deviceId: draft.pins.device.id,
      manualCapture: draft.manualCapture,
    };
    const pins = resolveReleasePins({ ...frame, selection });
    if (!pins || (await this.deps.store.taskCaptured(draft.ownerKey, pins.task.id))) return false;
    const fresh = {
      ...draft,
      pins,
      shiftId: frame.shiftId,
      timezone: frame.timezone,
      deviceTime: frame.deviceTime,
      trainingVersionId: pins.eligibility.training_version_ids[0] ?? "",
    };
    return safeFreshOrigin(draft, fresh, this.deps.now());
  }
  async #readSaved(source: ReleaseProjectionSource, stored: StoredRelease): Promise<ReleaseState> {
    const review = await this.#review(source, stored.draft.eventId);
    const evidencePending = await this.deps.store.evidencePending(stored.draft);
    if (!source.handle.isCurrent()) throw new ReleaseError("scope");
    return { ...EMPTY, draft: stored.draft, event: stored.event, review, evidencePending };
  }
  async #review(source: ReleaseProjectionSource, eventId: string) {
    const history = await activeFeedback(this.deps.store.db, source.handle);
    const reviews = history.filter(
      (entry): entry is Schemas["ReviewHistoryEntry"] =>
        entry.kind === "review_decision" && entry.source_event_id === eventId,
    );
    return reviews.reduce<Schemas["ReviewHistoryEntry"] | null>(
      (latest, entry) => (latest === null || entry.revision > latest.revision ? entry : latest),
      null,
    );
  }
  async read(selection: ReleaseSelection): Promise<ReleaseState> {
    if (!this.deps.canCapture() || !this.deps.current()) return EMPTY;
    const identity = this.#identity(),
      owner = ownerKey(identity.owner);
    const draft = (await this.deps.store.list(owner)).find((entry) => matches(entry, selection));
    const stored = draft ? await this.deps.store.read(draft.eventId, owner) : null;
    try {
      const state = await this.#readSource(selection, stored);
      this.assertIdentity(identity);
      return state;
    } catch (error) {
      if (!(error instanceof ReleaseProjectionUnavailable || error instanceof ReleaseError))
        throw error;
      this.assertIdentity(identity);
      return stored === null
        ? EMPTY
        : {
            ...EMPTY,
            draft: stored.draft,
            event: stored.event,
            evidencePending: await this.deps.store.evidencePending(stored.draft),
          };
    }
  }
  async #context<Result>(
    input: WriteRequest,
    apply: (context: ReleaseWriteContext) => Promise<Result>,
  ) {
    const { id } = input;
    const fence = await this.deps.attachments.session.capture(),
      shift = await this.deps.shift();
    const stored = await this.deps.store.read(id, fence.ownerKey);
    if (!stored || stored.event || stored.supersededBy || stored.draft.shiftId !== shift.id)
      throw new ReleaseError("stale_draft");
    return this.deps.bundle.withReleaseProjection((source) =>
      this.#writeContext({ ...input, source, stored, shift, fence }, apply),
    );
  }
  async #writeContext<Result>(
    input: ReadWriteContext,
    apply: (context: ReleaseWriteContext) => Promise<Result>,
  ) {
    const { source, stored, shift, fence, id } = input;
    const draft = input.sealCapture
      ? { ...stored.draft, deviceTime: this.deps.now().toISOString() }
      : stored.draft;
    const current = await this.#currentState(source, draft);
    this.assertIdentity(input.identity);
    return apply({
      draft,
      effective: current.draft,
      gates: current.gates,
      fence,
      canUpload: source.canUpload,
      captureVersion: current.current?.captureVersion ?? "",
      guards: [
        source.guard,
        shift.guard,
        this.deps.store.draftGuard({ id, raw: stored.raw, fence }),
        current.reservations.guard,
      ],
    });
  }
  edit(id: string, quantity: string): Promise<void> {
    return this.#run((identity) =>
      this.#context({ id, identity }, ({ draft, guards }) =>
        this.deps.store.update({ ...draft, quantity }, guards),
      ),
    );
  }
  undoPhoto(id: string): Promise<void> {
    return this.#run((identity) =>
      this.#context({ id, identity }, ({ draft, guards }) =>
        this.deps.store.update({ ...draft, evidence: draft.evidence.slice(0, -1) }, guards),
      ),
    );
  }
  async locate(id: string, isCurrent: () => boolean): Promise<void> {
    const identity = this.#identity(),
      gps = await this.deps.gps.locate();
    this.assertIdentity(identity);
    if (!isCurrent()) throw new ReleaseError("stale_draft");
    await this.#run((original) =>
      this.#context({ id, identity: original }, ({ draft, guards }) =>
        this.deps.store.update({ ...draft, gps }, guards),
      ),
    );
  }
  async photo(id: string, isCurrent: () => boolean): Promise<void> {
    const identity = this.#identity();
    const context = await this.#run((original) =>
      this.#context({ id, identity: original }, (value) => Promise.resolve(value)),
    );
    if (!context.canUpload) throw new ReleaseError("scope");
    await captureReleasePhoto({
      ...this.deps,
      context,
      isCurrent,
      assertIdentity: () => {
        this.assertIdentity(identity);
      },
    });
    this.#publish();
  }
  async save(id: string, isCurrent: () => boolean = () => true): Promise<void> {
    await this.locate(id, isCurrent);
    return this.#run((identity) =>
      this.#context({ id, identity, sealCapture: true }, async (context) => {
        if (!isCurrent()) throw new ReleaseError("stale_draft");
        if (!canSaveRelease(context.gates) || !context.canUpload)
          throw new ReleaseError("safety_blocked");
        const draft = {
          ...context.draft,
          assessment: {
            receiptLineId: context.effective.pins.custody.receipt_line_id,
            captureVersion: context.captureVersion,
            assessedAt: this.deps.now().toISOString(),
            rulesVersion: context.draft.rulesVersion,
            gates: context.gates.map(({ name, state }) => ({ name, state })),
          },
        };
        await this.deps.engine.enqueue(releaseEvent(context.effective), [
          ...this.deps.store.saveStatements(draft, context.guards),
          ...this.deps.attachments.store.bindingStatements({
            eventId: id,
            evidenceIds: draft.evidence.map(({ id: evidenceId }) => evidenceId),
            fence: context.fence,
          }),
        ]);
      }),
    );
  }
}
