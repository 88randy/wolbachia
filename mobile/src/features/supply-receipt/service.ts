import type { Attachments } from "../../attachments/create-attachments.ts";
import type { EvidenceFence } from "../../attachments/types.ts";
import { ownerKey } from "../../attachments/types.ts";
import { CURRENT_FENCE, fenceParams } from "../../attachments/attachment-store.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { SyncEngine } from "../../sync/sync-engine.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import type { CaptureShiftAuthorization } from "../ovitrap-check/shift-authorization.ts";
import { ReceiptError, receiptEvent, scanReceipt, validateReceipt } from "./domain.ts";
import { newReceiptDraft } from "./new-draft.ts";
import type { ReceiptDraft, ReceiptState } from "./receipt-types.ts";
import { ReceiptStore } from "./store.ts";
import { EMPTY_RECEIPT, readReceiptState } from "./read-state.ts";
import { captureReceipt } from "./capture-receipt.ts";
interface Dependencies {
  readonly store: ReceiptStore;
  readonly bundle: Pick<DayBundleService, "withSupplyAssignments" | "refresh" | "subscribe">;
  readonly attachments: Attachments;
  readonly engine: Pick<SyncEngine, "enqueue">;
  readonly current: () => EvidenceIdentity | null;
  readonly canCapture: () => boolean;
  readonly shift: () => Promise<CaptureShiftAuthorization>;
  readonly photo: EvidencePort;
  readonly uuid: () => string;
  readonly now: () => Date;
}
interface WriteContext {
  readonly draft: ReceiptDraft;
  readonly guards: readonly SqlStatement[];
  readonly fence: EvidenceFence;
}
/** One edit queue plus raw-draft/source/fence SQL CAS; native I/O never owns that queue. */
export class SupplyReceiptService {
  readonly deps: Dependencies;
  #selected: string | null = null;
  #feedback: ReceiptState["feedback"] = null;
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
    if (identity === null || !this.deps.canCapture()) throw new ReceiptError("scope");
    return identity;
  }
  #requireIdentity(original: EvidenceIdentity): void {
    const current = this.deps.current();
    if (
      current === null ||
      ownerKey(original.owner) !== ownerKey(current.owner) ||
      original.sessionId !== current.sessionId
    )
      throw new ReceiptError("scope");
  }
  #queue<T>(
    action: (identity: EvidenceIdentity, id: string | null) => Promise<T>,
    expected?: string,
  ): Promise<T> {
    const original = this.#identity();
    const id = this.#selected;
    if (expected !== undefined && expected !== id)
      return Promise.reject(new ReceiptError("stale_draft"));
    const run = this.#tail.then(async () => {
      this.#requireIdentity(original);
      if (!this.deps.canCapture()) throw new ReceiptError("scope");
      const result = await action(original, id);
      this.#publish();
      return result;
    });
    this.#tail = run.catch(() => undefined);
    return run;
  }
  async read(): Promise<ReceiptState> {
    const identity = this.deps.current();
    if (identity === null || !this.deps.canCapture()) return EMPTY_RECEIPT;
    const selected = this.#selected;
    const state = await readReceiptState({
      identity,
      selected,
      store: this.deps.store,
      bundle: this.deps.bundle,
      feedback: this.#feedback,
    });
    this.#requireIdentity(identity);
    if (selected !== this.#selected) throw new ReceiptError("stale_draft");
    this.#selected = state.draft?.eventId ?? null;
    return state;
  }
  refresh = async (): Promise<void> => {
    await this.deps.bundle.refresh(true);
    this.#publish();
  };
  select = async (id: string): Promise<void> => {
    await this.#queue(async (identity) => {
      if (!(await this.deps.store.read(id, ownerKey(identity.owner))))
        throw new ReceiptError("scope");
      this.#selected = id;
      this.#feedback = null;
    });
  };
  begin = (assignmentId: string, releaseId: string): Promise<void> =>
    this.#queue(async (identity) => {
      const fence = await this.deps.attachments.session.capture();
      this.#requireIdentity(identity);
      const shift = await this.deps.shift();
      await this.deps.bundle.withSupplyAssignments(async (source) => {
        this.#requireIdentity(identity);
        const assignment = source.assignments.find((row) => row.id === assignmentId);
        if (!assignment || (assignment.shift_id !== null && assignment.shift_id !== shift.id))
          throw new ReceiptError("scope");
        if (await this.deps.store.hasRelease(fence.ownerKey, releaseId))
          throw new ReceiptError("stale_draft");
        const draft = newReceiptDraft({
          assignment,
          releaseId,
          ownerKey: fence.ownerKey,
          shiftId: shift.id,
          versions: await this.deps.store.versions(),
          uuid: this.deps.uuid,
          now: this.deps.now(),
        });
        await this.deps.store.begin(draft, [
          source.guard,
          shift.guard,
          { sql: `SELECT 1 WHERE ${CURRENT_FENCE}`, params: fenceParams(fence) },
        ]);
        this.#selected = draft.eventId;
        this.#feedback = null;
      });
    });
  async #context<T>(
    identity: EvidenceIdentity,
    id: string | null,
    use: (context: WriteContext) => Promise<T>,
  ): Promise<T> {
    if (id === null || id !== this.#selected) throw new ReceiptError("stale_draft");
    const fence = await this.deps.attachments.session.capture();
    this.#requireIdentity(identity);
    const stored = await this.deps.store.read(id, fence.ownerKey);
    if (!stored || stored.event) throw new ReceiptError("stale_draft");
    const shift = await this.deps.shift();
    if (shift.id !== stored.draft.shiftId) throw new ReceiptError("shift");
    return this.deps.bundle.withSupplyAssignments(async (source) => {
      this.#requireIdentity(identity);
      if (!source.assignments.some((row) => row.id === stored.draft.assignmentId))
        throw new ReceiptError("scope");
      return use({
        draft: stored.draft,
        fence,
        guards: [
          source.guard,
          shift.guard,
          this.deps.store.draftGuard({ id, raw: stored.raw, fence }),
        ],
      });
    });
  }
  #edit(change: (draft: ReceiptDraft) => ReceiptDraft, expected?: string): Promise<void> {
    return this.#queue(
      (identity, id) =>
        this.#context(identity, id, async ({ draft, guards }) => {
          await this.deps.store.update(change(draft), guards);
        }),
      expected,
    );
  }
  quantity = (id: string, value: string, expected?: string) =>
    this.#edit(
      (draft) => ({
        ...draft,
        manualCapture: true,
        signature: null,
        lines: draft.lines.map((line) => (line.id === id ? { ...line, quantity: value } : line)),
      }),
      expected,
    );
  discrepancy = (kind: "missing" | "damaged" | "other", text: string, expected?: string) =>
    this.#edit((draft) => ({ ...draft, signature: null, discrepancy: { kind, text } }), expected);
  strokes = (strokes: readonly string[], expected?: string) =>
    this.#edit((draft) => ({ ...draft, signature: null, strokes }), expected);
  scan = (value: string, expected?: string) =>
    this.#edit((draft) => {
      const scanned = scanReceipt(draft, value);
      this.#feedback = scanned.feedback;
      return scanned.draft;
    }, expected);
  manual = (value: string, expected?: string) =>
    this.#edit((draft) => {
      const scanned = scanReceipt(draft, `wbf:1:lot:${value.trim().toLowerCase()}`);
      this.#feedback = scanned.feedback;
      return { ...scanned.draft, manualCapture: true };
    }, expected);
  signature = (port: EvidencePort, expected?: string) => this.#capture(port, true, expected);
  signaturePhoto = (expected?: string) => this.#capture(this.deps.photo, true, expected);
  photo = (expected?: string) => this.#capture(this.deps.photo, false, expected);
  async #capture(port: EvidencePort, isSignature: boolean, expected?: string): Promise<void> {
    const identity = this.#identity();
    const context = await this.#queue(
      (current, id) =>
        this.#context(current, id, (context) => {
          if (isSignature) validateReceipt(context.draft, false);
          return Promise.resolve(context);
        }),
      expected,
    );
    this.#requireIdentity(identity);
    await captureReceipt({
      store: this.deps.store,
      attachments: this.deps.attachments,
      draft: context.draft,
      guards: context.guards,
      port: {
        capture: (context) => {
          if (!this.deps.canCapture()) throw new ReceiptError("scope");
          return port.capture(context);
        },
      },
      isSignature,
      assertIdentity: () => {
        this.#requireIdentity(identity);
      },
      isSelected: () => this.#selected === context.draft.eventId,
    });
    this.#publish();
  }
  save = (expected?: string) =>
    this.#queue(
      (identity, id) =>
        this.#context(identity, id, async ({ draft, guards, fence }) => {
          const event = receiptEvent(draft);
          // B04 supplies.receive declares the signature only. Damage photos remain private local facts.
          const evidenceIds = draft.signature === null ? [] : [draft.signature.id];
          await this.deps.engine.enqueue(event, [
            ...this.deps.store.saveStatements(draft, guards),
            ...this.deps.attachments.store.bindingStatements({
              eventId: draft.eventId,
              evidenceIds,
              fence,
            }),
          ]);
        }),
      expected,
    );
}
