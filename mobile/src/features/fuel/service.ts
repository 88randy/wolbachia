import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import { FuelError, fuelEvent } from "./domain.ts";
import { FuelStore } from "./store.ts";
import type { FuelDraft, FuelState } from "./types.ts";
import { EMPTY_FUEL, readFuelState } from "./read-state.ts";
import { captureFuelReceipt } from "./capture-receipt.ts";

export interface FuelShift {
  readonly id: string;
  readonly motorcycleCode: string;
  readonly odometer: number;
  readonly guard: SqlStatement;
}
interface Dependencies {
  readonly store: FuelStore;
  readonly attachments: Attachments;
  readonly bundle: Pick<DayBundleService, "withFuelContext" | "subscribe">;
  readonly engine: Pick<SyncEngine, "enqueue">;
  readonly current: () => EvidenceIdentity | null;
  readonly canCapture: () => boolean;
  readonly shift: () => Promise<FuelShift>;
  readonly photo: EvidencePort;
  readonly uuid: () => string;
  readonly now: () => Date;
}
interface WriteContext {
  readonly draft: FuelDraft;
  readonly guards: readonly SqlStatement[];
  readonly fence: EvidenceFence;
  readonly canUpload: boolean;
}
type Editable = "litres" | "amount" | "odometer" | "isFullRefill";
function hasDecreasedDraft(state: FuelState, shift: FuelShift, isCurrent: boolean): boolean {
  if (!isCurrent || state.event !== null || state.draft === null) return false;
  return /^\d{1,6}$/.test(state.draft.odometer) && Number(state.draft.odometer) < shift.odometer;
}
/** One edit queue plus original source/raw-draft/session SQL CAS; camera I/O never owns the queue. */
export class FuelService {
  readonly deps: Dependencies;
  #selected: string | null = null;
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
    if (identity === null || !this.deps.canCapture()) throw new FuelError("scope");
    return identity;
  }
  #requireIdentity(original: EvidenceIdentity): void {
    const current = this.deps.current();
    if (
      current === null ||
      ownerKey(current.owner) !== ownerKey(original.owner) ||
      current.sessionId !== original.sessionId
    )
      throw new FuelError("scope");
  }
  #queue<T>(
    action: (identity: EvidenceIdentity, id: string | null) => Promise<T>,
    expected?: string,
  ): Promise<T> {
    const original = this.#identity(),
      id = this.#selected;
    if (expected !== undefined && expected !== id)
      return Promise.reject(new FuelError("stale_draft"));
    const run = this.#tail.then(async () => {
      this.#requireIdentity(original);
      if (!this.deps.canCapture()) throw new FuelError("scope");
      const result = await action(original, id);
      this.#publish();
      return result;
    });
    this.#tail = run.catch(() => undefined);
    return run;
  }
  async read(): Promise<FuelState> {
    const identity = this.deps.current();
    if (identity === null || !this.deps.canCapture()) return EMPTY_FUEL;
    const selected = this.#selected;
    let state = await readFuelState({ ...this.deps, identity, selected });
    state = await this.#shiftState(state);
    this.#requireIdentity(identity);
    if (selected !== this.#selected) throw new FuelError("stale_draft");
    this.#selected = state.draft?.eventId ?? null;
    return state;
  }
  async #shiftState(state: FuelState): Promise<FuelState> {
    try {
      const shift = await this.deps.shift(),
        draft = state.draft;
      const isCurrent =
        draft === null ||
        (draft.shiftId === shift.id && draft.motorcycleCode === shift.motorcycleCode);
      const decreased = hasDecreasedDraft(state, shift, isCurrent);
      return {
        ...state,
        canBegin: state.ready,
        ready: state.ready && isCurrent,
        advisory: decreased ? { ...state.advisory, kind: "decreased" } : state.advisory,
      };
    } catch (error) {
      if (!(error instanceof FuelError)) throw error;
      return { ...state, ready: false };
    }
  }
  select = (id: string): Promise<void> =>
    this.#queue(async (identity) => {
      if (!(await this.deps.store.read(id, ownerKey(identity.owner)))) throw new FuelError("scope");
      this.#selected = id;
    });
  begin = (): Promise<void> =>
    this.#queue(async (identity) => {
      const fence = await this.deps.attachments.session.capture(),
        shift = await this.deps.shift();
      this.#requireIdentity(identity);
      await this.deps.bundle.withFuelContext(async (source) => {
        this.#requireIdentity(identity);
        const existing = (await this.deps.store.list(fence.ownerKey)).find(
          (draft) => draft.shiftId === shift.id,
        );
        const stored = existing
          ? await this.deps.store.read(existing.eventId, fence.ownerKey)
          : null;
        if (stored && !stored.event) {
          this.#selected = stored.draft.eventId;
          return;
        }
        const draft = await this.#newDraft(fence, shift);
        await this.deps.store.begin(draft, [
          source.guard,
          shift.guard,
          { sql: `SELECT 1 WHERE ${CURRENT_FENCE}`, params: fenceParams(fence) },
        ]);
        this.#selected = draft.eventId;
      });
    });
  async #newDraft(fence: EvidenceFence, shift: FuelShift): Promise<FuelDraft> {
    const versions = await this.deps.store.versions();
    return {
      eventId: this.deps.uuid(),
      ownerKey: fence.ownerKey,
      shiftId: shift.id,
      motorcycleCode: shift.motorcycleCode,
      deviceTime: this.deps.now().toISOString(),
      catalogVersion: versions.catalog,
      rulesVersion: versions.rules,
      litres: "",
      amount: "",
      currency: "MXN",
      odometer: "",
      isFullRefill: false,
      receipt: null,
    };
  }
  async #context<T>(
    identity: EvidenceIdentity,
    id: string | null,
    use: (context: WriteContext) => Promise<T>,
  ): Promise<T> {
    if (id === null || id !== this.#selected) throw new FuelError("stale_draft");
    const fence = await this.deps.attachments.session.capture();
    this.#requireIdentity(identity);
    const stored = await this.deps.store.read(id, fence.ownerKey),
      shift = await this.deps.shift();
    if (!stored || stored.event) throw new FuelError("stale_draft");
    if (stored.draft.shiftId !== shift.id || stored.draft.motorcycleCode !== shift.motorcycleCode)
      throw new FuelError("shift");
    return this.deps.bundle.withFuelContext((source) => {
      this.#requireIdentity(identity);
      return use({
        draft: stored.draft,
        fence,
        canUpload: source.canUpload,
        guards: [
          source.guard,
          shift.guard,
          this.deps.store.draftGuard({ id, raw: stored.raw, fence }),
        ],
      });
    });
  }
  edit = (field: Editable, value: string | boolean, expected?: string): Promise<void> =>
    this.#queue(
      (identity, id) =>
        this.#context(identity, id, async ({ draft, guards }) => {
          if ((field === "isFullRefill") !== (typeof value === "boolean"))
            throw new FuelError("context_unavailable");
          await this.deps.store.update({ ...draft, [field]: value }, guards);
        }),
      expected,
    );
  async photo(expected?: string): Promise<void> {
    const identity = this.#identity();
    const context = await this.#queue(
      (current, id) => this.#context(current, id, (context) => Promise.resolve(context)),
      expected,
    );
    if (!context.canUpload) throw new FuelError("scope");
    this.#requireIdentity(identity);
    await captureFuelReceipt({
      ...this.deps,
      draft: context.draft,
      guards: context.guards,
      port: {
        capture: (context) => {
          if (!this.deps.canCapture()) throw new FuelError("scope");
          return this.deps.photo.capture(context);
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
          await this.deps.engine.enqueue(fuelEvent(draft), [
            ...this.deps.store.saveStatements(draft, guards),
            ...this.deps.attachments.store.bindingStatements({
              eventId: draft.eventId,
              evidenceIds: draft.receipt ? [draft.receipt.id] : [],
              fence,
            }),
          ]);
        }),
      expected,
    );
}
