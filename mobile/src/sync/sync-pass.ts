import { KV_KEYS, removeStatement, setStatement } from "../db/kv-store.ts";
import type { KvStore } from "../db/kv-store.ts";
import type { SqlStatement } from "../db/sql.ts";
import type { OutboxEvent } from "../outbox/outbox-event.ts";
import type { OutboxRepository, OutboxTransition } from "../outbox/outbox-repository.ts";
import { quotaTransition, quotaWaitOutcome, missingResultOutcome } from "./sync-results.ts";
import { planFailure } from "./sync-failure.ts";
import type { BlockReason, SyncFailure } from "./sync-failure.ts";
import type {
  SyncBatchRequest,
  SyncCallResult,
  SyncResponse,
  SyncTransport,
} from "./sync-transport.ts";

/** Events per request. A technical limit under the server's `SYNC_MAX_EVENTS` (200). [ASSUMPTION] until #13. */
export const SYNC_BATCH_SIZE = 50;

export interface SyncPassDeps {
  readonly outbox: OutboxRepository;
  readonly kv: KvStore;
  readonly transport: SyncTransport;
  readonly deviceId: string;
  readonly now: () => Date;
  /** Projection failures propagate before any cursor advance. Replays are idempotent. */
  readonly serializeProjectionPass?: (pass: () => Promise<PassOutcome>) => Promise<PassOutcome>;
  readonly applyProjectionChanges?: (changes: SyncResponse["changes"]) => Promise<void>;
  readonly recoverProjections?: () => Promise<void>;
  readonly revokeProjections?: () => Promise<void>;
}

/** State that lives as long as the engine: a `413` shrinks the batch for the following passes too. */
export interface PassState {
  batchSize: number;
}

/** How a pass ended. The engine decides when to run the next one. */
export type PassOutcome =
  /** Everything that could be sent was sent. */
  | { readonly kind: "idle" }
  /** Try again later. `delayMs: null` means "use the backoff"; `countsAsFailure` feeds the backoff. */
  | {
      readonly kind: "retry";
      readonly delayMs: number | null;
      readonly countsAsFailure: boolean;
      readonly code: string;
    }
  /** Stopped until sign-in, the clock or the permissions change. */
  | { readonly kind: "blocked"; readonly reason: BlockReason; readonly code: string };

type Step =
  | { readonly next: "again"; readonly pull: boolean }
  | { readonly next: "stop"; readonly outcome: PassOutcome };

interface PassContext {
  readonly deps: SyncPassDeps;
  readonly state: PassState;
  /** True once this pass dropped the cursor, so a second `invalid_cursor` cannot loop. */
  cursorReset: boolean;
}

/** How long the server asked us to wait, and the error code that said so. */
interface Wait {
  readonly delayMs: number;
  readonly code: string;
}

type EventAction = "release" | "failTransient" | "failPermanent";

const CONTINUE: Step = { next: "again", pull: false };

function failureCode(failure: SyncFailure): string {
  if (failure.kind === "network") return "network";
  return failure.code === "unknown_error" ? `http_${String(failure.status)}` : failure.code;
}

function transitionFor(event: OutboxEvent, response: SyncResponse, now: Date): OutboxTransition {
  const result = response.results.find((candidate) => candidate.id === event.envelope.id);
  if (result === undefined) {
    return { id: event.envelope.id, action: "failTransient", lastError: "missing_event_result" };
  }
  if (result.code === "rejection_quota_exceeded") return quotaTransition(result, now);
  const action = { accepted: "accept", rejected: "reject", in_review: "review" } as const;
  return {
    id: event.envelope.id,
    action: action[result.status],
    lastError: null,
    result: { code: result.code, params: result.params },
  };
}

function bookkeeping(response: SyncResponse, now: Date): SqlStatement[] {
  const { cursor, catalog_version: catalog, rules_version: rules } = response.changes;
  const statements = [setStatement(KV_KEYS.lastSyncAt, now.toISOString())];
  if (cursor !== null) statements.push(setStatement(KV_KEYS.syncCursor, cursor));
  if (catalog !== null) statements.push(setStatement(KV_KEYS.catalogVersion, catalog));
  if (rules !== null) statements.push(setStatement(KV_KEYS.rulesVersion, rules));
  return statements;
}

async function applyAnswer(
  { deps }: PassContext,
  batch: readonly OutboxEvent[],
  call: Extract<SyncCallResult, { readonly ok: true }>,
): Promise<void> {
  const response = call.response;
  // A final upload grants no downloadable projections; acknowledge its results before revoking access.
  if (canDownload(call)) await deps.applyProjectionChanges?.(response.changes);
  const sentIds = new Set(batch.map((event) => event.envelope.id));
  // The server also lists a review item for every event of this batch it rejected or put in
  // review; those are already in `results`. Only reviews of other events add information.
  const others = response.changes.reviews.filter((review) => !sentIds.has(review.event_id));
  const pulled = await deps.outbox.pulledReviewTransitions(
    others.map((review) => ({
      eventId: review.event_id,
      kind: review.kind,
      result: { code: review.code, params: review.params },
    })),
  );
  const answered = batch.map((event) => transitionFor(event, response, deps.now()));
  // One transaction: statuses, cursor and versions are saved together or not at all.
  const statements = canDownload(call)
    ? bookkeeping(response, deps.now())
    : [setStatement(KV_KEYS.lastSyncAt, deps.now().toISOString())];
  await deps.outbox.settle([...answered, ...pulled], statements);
}

function eventsTo(
  batch: readonly OutboxEvent[],
  action: EventAction,
  error: string | null,
): OutboxTransition[] {
  return batch.map((event) => ({
    id: event.envelope.id,
    action,
    ...(error === null ? {} : { lastError: error }),
  }));
}

function stop(outcome: PassOutcome): Step {
  return { next: "stop", outcome };
}

async function retryLater(context: PassContext, batch: readonly OutboxEvent[], code: string) {
  await context.deps.outbox.settle(eventsTo(batch, "failTransient", code));
  return stop({ kind: "retry", delayMs: null, countsAsFailure: true, code });
}

async function waitAsked(context: PassContext, batch: readonly OutboxEvent[], wait: Wait) {
  await context.deps.outbox.settle(eventsTo(batch, "release", null));
  return stop({ kind: "retry", delayMs: wait.delayMs, countsAsFailure: false, code: wait.code });
}

async function dropCursor(context: PassContext, batch: readonly OutboxEvent[]): Promise<Step> {
  const drop =
    context.deps.recoverProjections === undefined ? [removeStatement(KV_KEYS.syncCursor)] : [];
  await context.deps.outbox.settle(eventsTo(batch, "release", null), drop);
  await context.deps.recoverProjections?.();
  context.cursorReset = true;
  // The pull that failed must be repeated without the cursor, even when the batch was empty.
  return { next: "again", pull: true };
}

async function shrinkBatch(context: PassContext, batch: readonly OutboxEvent[]): Promise<Step> {
  await context.deps.outbox.settle(eventsTo(batch, "release", null));
  context.state.batchSize = Math.max(1, Math.floor(batch.length / 2));
  return CONTINUE;
}

/** An indexed envelope error quarantines just those records; the rest were never processed. */
async function parkMalformed(
  context: PassContext,
  batch: readonly OutboxEvent[],
  failure: SyncFailure,
): Promise<Step> {
  const fields = failure.kind === "http" ? Object.keys(failure.fieldCodes) : [];
  const indices = new Set(
    fields
      .flatMap((field) => {
        const match = /^events\.(0|[1-9]\d*)(?:\.|$)/.exec(field);
        return match === null ? [] : [Number(match[1])];
      })
      .filter((index) => index < batch.length),
  );
  const changes = batch.map((event, index): OutboxTransition => ({
    id: event.envelope.id,
    action: indices.size === 0 || indices.has(index) ? "failPermanent" : "release",
    lastError: failureCode(failure),
  }));
  await context.deps.outbox.settle(changes);
  return CONTINUE;
}

function isProjectionRevoked(failure: SyncFailure): boolean {
  return (
    failure.kind === "http" &&
    (failure.status === 403 || (failure.status === 401 && failure.code === "session_revoked"))
  );
}

async function handleFailure(
  context: PassContext,
  batch: readonly OutboxEvent[],
  failure: SyncFailure,
): Promise<Step> {
  const code = failureCode(failure);
  if (isProjectionRevoked(failure)) await context.deps.revokeProjections?.();
  const plan = planFailure(failure, {
    batchSize: batch.length,
    cursorAlreadyReset: context.cursorReset,
  });
  const { outbox } = context.deps;
  switch (plan.action) {
    case "retry":
      return retryLater(context, batch, code);
    case "wait":
      return waitAsked(context, batch, { delayMs: plan.retryAfterMs, code });
    case "block":
      await outbox.settle(eventsTo(batch, "release", code));
      return stop({ kind: "blocked", reason: plan.reason, code });
    case "park":
      return parkMalformed(context, batch, failure);
    case "resetCursor":
      return dropCursor(context, batch);
    case "splitBatch":
      return shrinkBatch(context, batch);
  }
}

function canDownload(call: SyncCallResult): boolean {
  return (
    call.isSessionRevoked !== true &&
    call.needsFinalUpload !== true &&
    call.completeSession === undefined
  );
}
/** Session completion belongs after durable batch settlement and downloaded-access cleanup. */
async function finishSession({ deps }: PassContext, complete?: () => Promise<void>): Promise<Step> {
  if (deps.revokeProjections === undefined) await deps.kv.remove(KV_KEYS.syncCursor);
  else await deps.revokeProjections();
  await complete?.();
  return stop({ kind: "blocked", reason: "needsLogin", code: "session_revoked" });
}
async function failedCall(
  context: PassContext,
  batch: readonly OutboxEvent[],
  call: Extract<SyncCallResult, { readonly ok: false }>,
): Promise<Step> {
  const step = await handleFailure(context, batch, call.failure);
  if (call.completeSession !== undefined) return finishSession(context, call.completeSession);
  if (
    call.needsFinalUpload === true &&
    call.failure.kind === "http" &&
    [401, 403].includes(call.failure.status)
  )
    return { next: "again", pull: true };
  return step;
}
async function sendBatch(context: PassContext, batch: readonly OutboxEvent[]): Promise<Step> {
  const { deps } = context;
  const cursor = await deps.kv.get(KV_KEYS.syncCursor);
  const request: SyncBatchRequest = {
    device_id: deps.deviceId,
    sent_at: deps.now().toISOString(),
    ...(cursor === null ? {} : { cursor }),
    events: batch.map((event) => event.envelope),
  };
  const call = await deps.transport(request);
  if (!call.ok) return failedCall(context, batch, call);
  await applyAnswer(context, batch, call);
  if (call.completeSession !== undefined || call.isSessionRevoked === true)
    return finishSession(context, call.completeSession);
  const missing = missingResultOutcome(batch, call.response);
  if (missing !== null) return stop(missing);
  return { next: "again", pull: call.response.changes.has_more || call.needsFinalUpload === true };
}

/**
 * One sync pass: send every pending event in order, in batches, and pull what changed for the
 * phone. It always asks the server at least once (an empty batch is a pure pull). Network and
 * server problems become an outcome, never an exception; a storage error from the outbox does
 * propagate, and the engine reports it.
 *
 * Concurrency rule: a pass is the only code that moves events in or out of `sending`, and the
 * engine never runs two passes at once (see `SyncEngine`).
 */
async function runPass(deps: SyncPassDeps, state: PassState): Promise<PassOutcome> {
  const context: PassContext = { deps, state, cursorReset: false };
  let pull = true;
  for (;;) {
    const batch = await deps.outbox.claimPending(state.batchSize);
    if (batch.length === 0 && !pull) {
      const delayMs = await deps.outbox.nextRetryDelayMs();
      return delayMs === null ? { kind: "idle" } : quotaWaitOutcome(delayMs);
    }
    const step = await sendBatch(context, batch);
    if (step.next === "stop") return step.outcome;
    pull = step.pull;
  }
}

/** The optional shared turn prevents an in-flight sync answer from superseding a newer bootstrap/revocation. */
export function runSyncPass(deps: SyncPassDeps, state: PassState): Promise<PassOutcome> {
  const pass = () => runPass(deps, state);
  return deps.serializeProjectionPass === undefined ? pass() : deps.serializeProjectionPass(pass);
}
