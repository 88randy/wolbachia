import type { Schemas } from "@wolbachia/api-client";
import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import { FuelError } from "../fuel/domain.ts";
import { IncidentError, incidentEvent, callWorkContact, telephoneNumber } from "./domain.ts";
import type { Dialer } from "./domain.ts";
import { IncidentStore } from "./store.ts";
import { readIncidentAuthority } from "./authority.ts";
import type { IncidentAuthority } from "./authority.ts";
import type { IncidentDraft, IncidentState, IncidentKind, IncidentGps } from "./types.ts";
import { FIX_FRESHNESS_MS } from "../day/location.ts";
import { captureIncidentPhoto } from "./capture-photo.ts";
import type { createIncidentRemote } from "./remote.ts";

export interface IncidentShift {
  readonly id: string | null;
  readonly guard: SqlStatement;
}
interface Dependencies {
  readonly store: IncidentStore;
  readonly attachments: Attachments;
  readonly bundle: Pick<DayBundleService, "withFuelContext" | "subscribe">;
  readonly engine: Pick<SyncEngine, "enqueue">;
  readonly current: () => EvidenceIdentity | null;
  readonly canCapture: () => boolean;
  readonly shift: () => Promise<IncidentShift>;
  readonly photo: EvidencePort;
  readonly lastGps: () => Promise<IncidentGps | null>;
  readonly remote: ReturnType<typeof createIncidentRemote>;
  readonly dialer: Dialer;
  readonly uuid: () => string;
  readonly now: () => Date;
}
interface WriteContext {
  readonly draft: IncidentDraft;
  readonly guards: readonly SqlStatement[];
  readonly fence: EvidenceFence;
  readonly authority: IncidentAuthority;
  readonly types: readonly Schemas["IncidentType"][];
}
export const EMPTY_INCIDENTS: IncidentState = {
  ready: false,
  canBegin: false,
  canRead: false,
  canUpload: false,
  draft: null,
  drafts: [],
  event: null,
  evidencePending: false,
  types: [],
  incidents: [],
  supportContact: null,
};

/** One local writer plus original profile/scope/raw-draft/fence CAS; native and HTTP never own it. */
export class IncidentService {
  readonly deps: Dependencies;
  #selected: string | null = null;
  #tail: Promise<unknown> = Promise.resolve();
  #gps: { readonly identity: EvidenceIdentity; readonly snapshot: IncidentGps | null } | null =
    null;
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
    if (!identity || !this.deps.canCapture()) throw new IncidentError("scope");
    return identity;
  }
  #requireIdentity(original: EvidenceIdentity): void {
    const current = this.deps.current();
    if (
      !current ||
      ownerKey(current.owner) !== ownerKey(original.owner) ||
      current.sessionId !== original.sessionId
    )
      throw new IncidentError("scope");
  }
  #queue<T>(
    action: (identity: EvidenceIdentity, id: string | null) => Promise<T>,
    expected?: string,
  ): Promise<T> {
    const original = this.#identity(),
      id = this.#selected;
    if (expected !== undefined && expected !== id)
      return Promise.reject(new IncidentError("stale_draft"));
    const run = this.#tail.then(async () => {
      this.#requireIdentity(original);
      if (!this.deps.canCapture()) throw new IncidentError("scope");
      const result = await action(original, id);
      this.#publish();
      return result;
    });
    this.#tail = run.catch(() => undefined);
    return run;
  }
  async #authority<T>(action: (source: IncidentAuthority) => Promise<T>): Promise<T> {
    try {
      return await this.deps.bundle.withFuelContext(async (source) =>
        action(await readIncidentAuthority(this.deps.store.db, source)),
      );
    } catch (error) {
      if (error instanceof FuelError) throw new IncidentError("scope");
      throw error;
    }
  }
  async read(): Promise<IncidentState> {
    const identity = this.deps.current();
    if (!identity || !this.deps.canCapture()) return EMPTY_INCIDENTS;
    const selected = this.#selected,
      key = ownerKey(identity.owner);
    const local = await this.#localState(key, selected);
    const state = await this.#readAuthority(local, key);
    this.#requireIdentity(identity);
    if (selected !== this.#selected) throw new IncidentError("stale_draft");
    this.#selected = local.draft?.eventId ?? null;
    return state;
  }
  async #localState(key: string, selected: string | null): Promise<IncidentState> {
    const drafts = await this.deps.store.list(key),
      id = selected ?? drafts[0]?.eventId ?? null;
    const stored = id ? await this.deps.store.read(id, key) : null;
    if (!stored) return { ...EMPTY_INCIDENTS, drafts };
    return {
      ...EMPTY_INCIDENTS,
      draft: stored.draft,
      event: stored.event,
      drafts,
      evidencePending: await this.deps.store.evidencePending(stored.draft),
    };
  }
  async #readAuthority(state: IncidentState, key: string): Promise<IncidentState> {
    try {
      return await this.#authority(async (source) => {
        const cache = await this.deps.store.cache(key, source.signature);
        const shift = await this.deps.shift();
        const content =
          source.canRead && cache
            ? { types: cache.types, incidents: cache.incidents }
            : { types: [], incidents: [] };
        return {
          ...state,
          canBegin: source.canCreate,
          ready: source.canCreate && (!state.draft || state.draft.shiftId === shift.id),
          canRead: source.canRead,
          canUpload: source.canUpload,
          ...content,
          supportContact: telephoneNumber(cache?.supportContact ?? null),
        };
      });
    } catch (error) {
      if (!(error instanceof IncidentError)) throw error;
      return state;
    }
  }
  select = (id: string): Promise<void> =>
    this.#queue(async (identity) => {
      if (!(await this.deps.store.read(id, ownerKey(identity.owner))))
        throw new IncidentError("scope");
      this.#selected = id;
    });
  /** Optional preload never owns the capture writer and never changes an existing observation. */
  async prepareGps(): Promise<void> {
    const identity = this.#identity(),
      snapshot = await this.deps.lastGps();
    this.#requireIdentity(identity);
    this.#gps = { identity, snapshot };
  }
  begin(kind: IncidentKind): Promise<void> {
    return this.#queue(async (identity) => {
      const fence = await this.deps.attachments.session.capture(),
        shift = await this.deps.shift();
      if (kind === "report" && shift.id === null) throw new IncidentError("shift");
      await this.#authority(async (source) => {
        this.#requireIdentity(identity);
        if (!source.canCreate) throw new IncidentError("scope");
        const existing = (await this.deps.store.list(fence.ownerKey)).find(
          (draft) => draft.kind === kind && draft.shiftId === shift.id,
        );
        if (existing && !(await this.deps.store.read(existing.eventId, fence.ownerKey))?.event) {
          this.#selected = existing.eventId;
          return;
        }
        const draft = await this.#newDraft({ fence, shift, kind, identity });
        await this.deps.store.begin(draft, [
          source.guard,
          shift.guard,
          { sql: `SELECT 1 WHERE ${CURRENT_FENCE}`, params: fenceParams(fence) },
        ]);
        this.#selected = draft.eventId;
      });
    });
  }
  async #newDraft(input: {
    readonly fence: EvidenceFence;
    readonly shift: IncidentShift;
    readonly kind: IncidentKind;
    readonly identity: EvidenceIdentity;
  }): Promise<IncidentDraft> {
    const versions = await this.deps.store.versions(),
      gps = this.#gps;
    const hasGps =
      gps?.identity.sessionId === input.identity.sessionId &&
      ownerKey(gps.identity.owner) === input.fence.ownerKey;
    return {
      eventId: this.deps.uuid(),
      ownerKey: input.fence.ownerKey,
      kind: input.kind,
      shiftId: input.shift.id,
      deviceTime: this.deps.now().toISOString(),
      catalogVersion: versions.catalog,
      rulesVersion: versions.rules,
      description: "",
      type: null,
      evidence: [],
      gps: hasGps ? this.#freshGps(gps.snapshot) : null,
    };
  }
  #freshGps(snapshot: IncidentGps | null): FieldEventEnvelope["gps"] {
    const age = this.deps.now().getTime() - (snapshot?.fixedAt ?? NaN);
    return snapshot && age >= 0 && age <= FIX_FRESHNESS_MS ? snapshot.fix : null;
  }
  async #context<T>(
    identity: EvidenceIdentity,
    id: string | null,
    use: (context: WriteContext) => Promise<T>,
  ): Promise<T> {
    if (!id || id !== this.#selected) throw new IncidentError("stale_draft");
    const fence = await this.deps.attachments.session.capture(),
      stored = await this.deps.store.read(id, fence.ownerKey),
      shift = await this.deps.shift();
    this.#requireIdentity(identity);
    if (!stored || stored.event) throw new IncidentError("stale_draft");
    if (stored.draft.shiftId !== shift.id) throw new IncidentError("shift");
    return this.#authority(async (authority) => {
      this.#requireIdentity(identity);
      if (!authority.canCreate) throw new IncidentError("scope");
      const cache = await this.deps.store.cache(fence.ownerKey, authority.signature);
      return use({
        draft: stored.draft,
        fence,
        authority,
        types: authority.canRead ? (cache?.types ?? []) : [],
        guards: [
          authority.guard,
          shift.guard,
          this.deps.store.draftGuard({ id, raw: stored.raw, fence }),
        ],
      });
    });
  }
  edit = (field: "description" | "type", value: string, expected?: string): Promise<void> =>
    this.#queue(
      (identity, id) =>
        this.#context(identity, id, async ({ draft, guards, types }) => {
          const type =
            field === "type" ? types.find((row) => row.current_version_id === value) : draft.type;
          if (field === "type" && (!type?.is_active || draft.kind !== "report"))
            throw new IncidentError("type_required");
          await this.deps.store.update(
            {
              ...draft,
              ...(field === "description" ? { description: value } : { type: type ?? null }),
            },
            guards,
          );
        }),
      expected,
    );
  undoPhoto = (expected?: string): Promise<void> =>
    this.#queue(
      (identity, id) =>
        this.#context(identity, id, ({ draft, guards }) =>
          this.deps.store.update({ ...draft, evidence: draft.evidence.slice(0, -1) }, guards),
        ),
      expected,
    );
  async photo(expected?: string): Promise<void> {
    const identity = this.#identity();
    const context = await this.#queue(
      (current, id) => this.#context(current, id, (context) => Promise.resolve(context)),
      expected,
    );
    if (!context.authority.canUpload) throw new IncidentError("scope");
    await captureIncidentPhoto({
      ...this.deps,
      draft: context.draft,
      guards: context.guards,
      photo: {
        capture: (request) => {
          if (!this.deps.canCapture()) throw new IncidentError("scope");
          return this.deps.photo.capture(request);
        },
      },
      assertIdentity: () => {
        this.#requireIdentity(identity);
      },
      isSelected: () => this.#selected === context.draft.eventId,
    });
    this.#publish();
  }
  save = (expected?: string): Promise<void> =>
    this.#queue(
      (identity, id) =>
        this.#context(identity, id, async ({ draft, guards, fence }) => {
          await this.deps.engine.enqueue(incidentEvent(draft), [
            ...this.deps.store.saveStatements(draft, guards),
            ...this.deps.attachments.store.bindingStatements({
              eventId: draft.eventId,
              evidenceIds: draft.evidence.map((photo) => photo.id),
              fence,
            }),
          ]);
        }),
      expected,
    );
  /** Network reads are optional. The first server page is filtered by genuine author/source identity. */
  async refresh(): Promise<void> {
    const identity = this.#identity(),
      source = await this.#authority((source) => Promise.resolve(source));
    const types = source.canRead ? await this.deps.remote.readTypes() : [];
    const incidents = source.canRead ? await this.deps.remote.readReported() : [];
    const supportContact = await this.deps.remote.readSupportContact();
    this.#requireIdentity(identity);
    await this.#queue(async () => {
      const drafts = await this.deps.store.list(ownerKey(identity.owner)),
        ownSources = new Set(drafts.map((draft) => draft.eventId));
      await this.deps.store.saveCache(
        ownerKey(identity.owner),
        {
          signature: source.signature,
          types,
          supportContact,
          incidents: incidents.filter(
            (incident) =>
              incident.created_by === identity.owner.userId ||
              (incident.source_event !== null && ownSources.has(incident.source_event)),
          ),
        },
        source.guard,
      );
    });
  }
  /** A work-contact call remains available under the local lock, without reading drafts or unlocking capture. */
  async call() {
    const identity = this.deps.current();
    if (!identity) return "missing" as const;
    try {
      const contact = await this.#authority(
        async (source) =>
          (await this.deps.store.cache(ownerKey(identity.owner), source.signature))
            ?.supportContact ?? null,
      );
      this.#requireIdentity(identity);
      return await callWorkContact(this.deps.dialer, contact);
    } catch (error) {
      if (!(error instanceof IncidentError)) throw error;
      return "missing" as const;
    }
  }
}
