import type { Schemas } from "@wolbachia/api-client";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { EvidencePort, GpsPort } from "../ovitrap-check/types.ts";
import { activeFeedback } from "../ovitrap-lifecycle/feedback.ts";
import { captureSamplePhoto } from "./capture-photo.ts";
import {
  hasSampleConfiguration,
  methodVerified,
  sameSource,
  sampleEvent,
  sampleGates,
  sampleSources,
  validSampleId,
} from "./domain.ts";
import type { SampleProjectionSource } from "./projection.ts";
import { SampleProjectionUnavailable } from "./projection.ts";
import { SampleError } from "./types.ts";
import type {
  SampleDraft,
  SamplePatch,
  SampleSelection,
  SampleSource,
  SampleState,
  SampleWork,
} from "./types.ts";
import type { SampleStore } from "./store.ts";

export interface SampleShift {
  readonly id: string;
  readonly guard: SqlStatement;
}
interface Dependencies {
  readonly store: SampleStore;
  readonly attachments: Attachments;
  readonly bundle: Pick<DayBundleService, "withSampleProjection" | "subscribe" | "refresh">;
  readonly engine: Pick<SyncEngine, "enqueue">;
  readonly current: () => EvidenceIdentity | null;
  readonly canCapture: () => boolean;
  readonly shift: () => Promise<SampleShift>;
  readonly timezone: () => string | null;
  readonly photo: EvidencePort;
  readonly gps: GpsPort;
  readonly uuid: () => string;
  readonly now: () => Date;
}
export interface SampleWriteContext {
  readonly draft: SampleDraft;
  readonly source: SampleProjectionSource;
  readonly guards: readonly SqlStatement[];
  readonly fence: EvidenceFence;
}
interface WriteRequest {
  readonly id: string;
  readonly identity: EvidenceIdentity;
  readonly sealCapture?: boolean;
}
type StoredSample = NonNullable<Awaited<ReturnType<SampleStore["read"]>>>;
const EMPTY: SampleState = {
  draft: null,
  event: null,
  ready: false,
  canBegin: false,
  evidencePending: false,
  gates: ["scope"],
  review: null,
  receipt: null,
  sources: [],
  origins: [],
  methods: [],
  work: [],
};
function receipt(source: SampleProjectionSource, draft: SampleDraft) {
  return (
    source.snapshot.receipts.find(
      (entry) =>
        entry.sample_id.toLowerCase() === draft.sampleId.toLowerCase() &&
        entry.event_id.toLowerCase() === draft.eventId.toLowerCase(),
    ) ?? null
  );
}
/** Local commands serialize only brief SQLite work; native camera/GPS never holds either queue. */
interface DraftSeed {
  readonly sampleId: string;
  readonly eventId: string;
  readonly instant: string;
  readonly shiftId: string;
  readonly timezone: string;
  readonly selected: SampleSource;
  readonly selection: SampleSelection;
}
function emptyDraft(seed: DraftSeed, source: SampleProjectionSource): SampleDraft {
  const { selected, instant } = seed;
  return {
    sampleId: seed.sampleId,
    eventId: seed.eventId,
    ownerKey: ownerKey(source.handle.owner),
    shiftId: seed.shiftId,
    startedAt: instant,
    deviceTime: instant,
    timezone: seed.timezone,
    manualCapture: seed.selection.manualCapture,
    sourceRef: { kind: selected.kind, id: selected.id },
    source: selected,
    captureVersion: source.snapshot.version,
    catalogVersion: source.catalogVersion,
    rulesVersion: source.rulesVersion,
    code: "",
    otherText: "",
    originCode: "",
    methodVersion: "",
    origin: null,
    method: null,
    gps: null,
    evidence: [],
  };
}
export class SampleService {
  readonly deps: Dependencies;
  #tail: Promise<unknown> = Promise.resolve();
  readonly #listeners = new Set<() => void>();
  constructor(deps: Dependencies) {
    this.deps = deps;
  }
  subscribe = (listener: () => void): (() => void) => {
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
    if (!identity || !this.deps.canCapture()) throw new SampleError("scope");
    return identity;
  }
  assertIdentity = (original: EvidenceIdentity): void => {
    const current = this.deps.current();
    if (
      !current ||
      ownerKey(current.owner) !== ownerKey(original.owner) ||
      current.sessionId !== original.sessionId
    )
      throw new SampleError("scope");
  };
  #run<Result>(action: (identity: EvidenceIdentity) => Promise<Result>): Promise<Result> {
    const original = this.#identity();
    const next = this.#tail.then(async () => {
      this.assertIdentity(original);
      if (!this.deps.canCapture()) throw new SampleError("scope");
      const result = await action(original);
      this.#publish();
      return result;
    });
    this.#tail = next.catch(() => undefined);
    return next;
  }
  #choices(source: SampleProjectionSource) {
    const instant = this.deps.now().toISOString();
    return {
      sources: sampleSources(source, instant),
      origins: source.origins,
      methods: source.snapshot.methods.filter((method) => methodVerified(method, instant)),
    };
  }
  async #work(source: SampleProjectionSource): Promise<readonly SampleWork[]> {
    const drafts = await this.deps.store.list(ownerKey(source.handle.owner));
    return Promise.all(
      drafts.map(async (draft) => {
        const stored = await this.deps.store.read(draft.sampleId, draft.ownerKey);
        return {
          sampleId: draft.sampleId,
          eventId: draft.eventId,
          code: draft.code,
          status: stored?.event?.status ?? "draft",
          receiptAt: receipt(source, draft)?.received_at ?? null,
        };
      }),
    );
  }
  async #hasAdmission(source: SampleProjectionSource): Promise<boolean> {
    const choices = this.#choices(source);
    if (
      !hasSampleConfiguration(source) ||
      !choices.sources.length ||
      !choices.methods.length ||
      !source.canUpload
    )
      return false;
    try {
      await this.deps.shift();
    } catch (error) {
      if (error instanceof SampleError && error.code === "shift") return false;
      throw error;
    }
    return Boolean(this.deps.timezone());
  }
  /** A QR supplies a new sample identity, never authority or a fabricated server resource. */
  async admit(sampleId: string, isCurrent: () => boolean): Promise<boolean> {
    if (!validSampleId(sampleId)) return false;
    const identity = this.#identity();
    return this.deps.bundle.withSampleProjection(async (source) => {
      const existing = await this.deps.store.read(sampleId, ownerKey(identity.owner));
      const hasSaved = existing !== null && existing.event !== null;
      const allowed = hasSaved || (await this.#hasAdmission(source));
      this.assertIdentity(identity);
      return allowed && isCurrent() && this.deps.canCapture() && source.handle.isCurrent();
    });
  }
  begin(selection: SampleSelection): Promise<string> {
    return this.#run(async (identity) => {
      const fence = await this.deps.attachments.session.capture();
      return this.deps.bundle.withSampleProjection(async (source) => {
        if (selection.sampleId) {
          const existing = await this.deps.store.read(selection.sampleId, fence.ownerKey);
          if (existing) return existing.draft.sampleId;
        }
        const draft = await this.#newDraft(selection, source),
          shift = await this.deps.shift();
        if (draft.shiftId !== shift.id) throw new SampleError("shift");
        this.assertIdentity(identity);
        await this.deps.store.begin(draft, [
          source.guard,
          shift.guard,
          { sql: `SELECT 1 WHERE ${CURRENT_FENCE}`, params: fenceParams(fence) },
        ]);
        return draft.sampleId;
      });
    });
  }
  async #newDraft(
    selection: SampleSelection,
    source: SampleProjectionSource,
  ): Promise<SampleDraft> {
    const instant = this.deps.now().toISOString(),
      shift = await this.deps.shift(),
      timezone = this.deps.timezone();
    const selected = this.#choices(source).sources.find(
      (entry) => selection.sourceRef !== null && sameSource(entry, selection.sourceRef),
    );
    if (!(await this.#hasAdmission(source)) || !timezone) throw new SampleError("configuration");
    if (!selected || !selection.sourceRef) throw new SampleError("source");
    const sampleId = (selection.sampleId ?? this.deps.uuid()).toLowerCase(),
      eventId = this.deps.uuid();
    if (!validSampleId(sampleId) || !validSampleId(eventId) || sampleId === eventId.toLowerCase())
      throw new SampleError("stale_draft");
    return emptyDraft(
      { sampleId, eventId, instant, shiftId: shift.id, timezone, selected, selection },
      source,
    );
  }
  async #review(source: SampleProjectionSource, eventId: string) {
    const history = await activeFeedback(this.deps.store.db, source.handle);
    return history.reduce<Schemas["ReviewHistoryEntry"] | null>((latest, entry) => {
      if (entry.kind !== "review_decision" || entry.source_event_id !== eventId) return latest;
      return latest === null || entry.revision > latest.revision ? entry : latest;
    }, null);
  }
  async #readStored(source: SampleProjectionSource, stored: StoredSample): Promise<SampleState> {
    const { draft, event } = stored;
    const common = {
      ...EMPTY,
      ...this.#choices(source),
      work: await this.#work(source),
      draft,
      event,
      receipt: receipt(source, draft),
      review: await this.#review(source, draft.eventId),
      evidencePending: await this.deps.store.evidencePending(draft),
    };
    if (event) return { ...common, gates: [] };
    let shift: SampleShift;
    try {
      shift = await this.deps.shift();
    } catch (error) {
      if (error instanceof SampleError && error.code === "shift")
        return { ...common, gates: ["shift"] };
      throw error;
    }
    return {
      ...common,
      ready: shift.id === draft.shiftId && hasSampleConfiguration(source),
      gates: sampleGates({ ...draft, deviceTime: this.deps.now().toISOString() }, source),
    };
  }
  async read(selection: SampleSelection): Promise<SampleState> {
    if (!this.deps.canCapture() || !this.deps.current()) return EMPTY;
    const identity = this.#identity();
    try {
      return await this.deps.bundle.withSampleProjection(async (source) => {
        const stored = selection.sampleId
          ? await this.deps.store.read(selection.sampleId, ownerKey(identity.owner))
          : null;
        const state = stored
          ? await this.#readStored(source, stored)
          : await this.#readNew(source, selection);
        this.assertIdentity(identity);
        return source.handle.isCurrent() ? state : EMPTY;
      });
    } catch (error) {
      if (error instanceof SampleError) return EMPTY;
      throw error;
    }
  }
  async #readNew(source: SampleProjectionSource, selection: SampleSelection): Promise<SampleState> {
    const choices = this.#choices(source),
      ready = await this.#hasAdmission(source);
    return {
      ...EMPTY,
      ...choices,
      ready,
      gates: ready ? [] : ["configuration"],
      work: await this.#work(source),
      canBegin:
        ready &&
        choices.sources.some(
          (entry) => selection.sourceRef !== null && sameSource(entry, selection.sourceRef),
        ),
    };
  }
  async #context<Result>(
    request: WriteRequest,
    apply: (context: SampleWriteContext) => Promise<Result>,
  ): Promise<Result> {
    const fence = await this.deps.attachments.session.capture(),
      shift = await this.deps.shift();
    const stored = await this.deps.store.read(request.id, fence.ownerKey);
    if (!stored || stored.event || stored.draft.shiftId !== shift.id)
      throw new SampleError("stale_draft");
    return this.deps.bundle.withSampleProjection((source) => {
      this.assertIdentity(request.identity);
      if (!source.handle.isCurrent()) throw new SampleProjectionUnavailable();
      const draft = request.sealCapture
        ? { ...stored.draft, deviceTime: this.deps.now().toISOString() }
        : stored.draft;
      return apply({
        draft,
        source,
        fence,
        guards: [
          source.guard,
          shift.guard,
          this.deps.store.draftGuard({ id: request.id, raw: stored.raw, fence }),
        ],
      });
    });
  }
  edit(id: string, patch: SamplePatch): Promise<void> {
    return this.#run((identity) =>
      this.#context({ id, identity }, ({ draft, source, guards }) => {
        const origin =
          patch.originCode === undefined
            ? draft.origin
            : (source.origins.find(({ code }) => code === patch.originCode) ?? null);
        const method =
          patch.methodVersion === undefined
            ? draft.method
            : (source.snapshot.methods.find(
                ({ id: methodId }) => methodId === patch.methodVersion,
              ) ?? null);
        return this.deps.store.update(
          {
            ...draft,
            ...patch,
            origin,
            method,
            catalogVersion:
              patch.originCode === undefined ? draft.catalogVersion : source.catalogVersion,
          },
          guards,
        );
      }),
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
    const identity = this.#identity();
    const context = await this.#run((original) =>
      this.#context({ id, identity: original }, (value) => Promise.resolve(value)),
    );
    const gps = await this.deps.gps.locate();
    this.assertIdentity(identity);
    if (!isCurrent()) throw new SampleError("stale_draft");
    await this.#run(() => this.deps.store.update({ ...context.draft, gps }, context.guards));
  }
  async photo(id: string, isCurrent: () => boolean): Promise<void> {
    const identity = this.#identity();
    const context = await this.#run((original) =>
      this.#context({ id, identity: original }, (value) => Promise.resolve(value)),
    );
    if (!context.source.canUpload) throw new SampleError("scope");
    await captureSamplePhoto({
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
    const identity = this.#identity(),
      stored = await this.deps.store.read(id, ownerKey(identity.owner));
    this.assertIdentity(identity);
    if (!isCurrent() || !this.deps.canCapture()) throw new SampleError("stale_draft");
    if (stored?.event) return; // Retry restores the original UUID and envelope; it never collects twice.
    await this.locate(id, isCurrent);
    return this.#run((original) =>
      this.#context({ id, identity: original, sealCapture: true }, async (context) => {
        if (!isCurrent()) throw new SampleError("stale_draft");
        const gates = sampleGates(context.draft, context.source);
        if (gates.length) throw new SampleError(gates[0] ?? "configuration");
        await this.deps.engine.enqueue(sampleEvent(context.draft), [
          ...this.deps.store.saveStatements(context.draft, context.guards),
          ...this.deps.attachments.store.bindingStatements({
            eventId: context.draft.eventId,
            evidenceIds: context.draft.evidence.map(({ id: evidenceId }) => evidenceId),
            fence: context.fence,
          }),
        ]);
      }),
    );
  }
}
