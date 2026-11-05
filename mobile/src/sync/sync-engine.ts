import { KV_KEYS } from "../db/kv-store.ts";
import type { FieldEventEnvelope } from "../outbox/outbox-event.ts";
import { backoffDelayMs } from "./backoff.ts";
import { runSyncPass, SYNC_BATCH_SIZE } from "./sync-pass.ts";
import type { PassOutcome, PassState, SyncPassDeps } from "./sync-pass.ts";
import type { BlockReason } from "./sync-failure.ts";
import { INITIAL_SNAPSHOT } from "./sync-snapshot.ts";
import type { SyncSnapshot } from "./sync-snapshot.ts";

export interface SyncEngineDeps {
  readonly pass: SyncPassDeps;
  /** True while a session token exists (login is #7). Without one nothing is sent. */
  readonly hasSession: () => boolean;
  /** True while a server address is configured. Without one nothing is sent. */
  readonly hasServer: () => boolean;
  /** A number in [0, 1) for the backoff jitter. */
  readonly random: () => number;
  /** Runs `callback` after `delayMs`; returns the function that cancels it. */
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
  /** Called with errors the engine cannot handle itself (for example a storage failure). */
  readonly report: (error: unknown) => void;
}

type Listener = () => void;

/**
 * The background sync worker. It runs in the JavaScript thread but never in the way of the UI:
 * every call below returns at once (or a promise nobody has to await) and all the work is
 * `async` I/O.
 *
 * The rule that makes a race impossible: **at most one pass runs at a time.** `requestSync`
 * while a pass is running does not start another one; it sets `#again`, and the running loop
 * makes exactly one more pass when it finishes. Since only a pass moves events through `sending`
 * (see `runSyncPass`), no two writers ever touch the same event.
 */
export class SyncEngine {
  readonly #deps: SyncEngineDeps;
  readonly #listeners = new Set<Listener>();
  readonly #passState: PassState = { batchSize: SYNC_BATCH_SIZE };
  #snapshot: SyncSnapshot = INITIAL_SNAPSHOT;
  #running: Promise<void> | null = null;
  #again = false;
  #forceOffline = false;
  #failuresInARow = 0;
  #cancelRetry: (() => void) | null = null;

  constructor(deps: SyncEngineDeps) {
    this.#deps = deps;
  }

  /** The current snapshot. Its identity changes only when something changed. */
  getSnapshot = (): SyncSnapshot => this.#snapshot;

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Call once at startup: events a killed process left in `sending` go back to `pending`. */
  async start(): Promise<void> {
    await this.#deps.pass.outbox.recoverInterrupted();
    await this.#refresh({ lastSyncAt: await this.#deps.pass.kv.get(KV_KEYS.lastSyncAt) });
    void this.requestSync();
  }

  /** Saves a captured event on the phone, then syncs in the background. Resolves once it is saved. */
  async enqueue(event: FieldEventEnvelope): Promise<void> {
    await this.#deps.pass.outbox.enqueue(event);
    await this.#refresh({});
    void this.requestSync();
  }

  setOnline(isOnline: boolean): void {
    if (isOnline === this.#snapshot.isOnline) return;
    this.#publish({ isOnline });
    if (isOnline) void this.requestSync();
  }

  /** Something outside changed (a person signed in, fixed the clock): try again now. */
  notifyConditionsChanged(): void {
    if (this.#snapshot.phase !== "blocked") return;
    void this.requestSync();
  }

  /** "Intentar ahora": parked events go back to the queue and a pass starts at once, even offline. */
  async retryNow(): Promise<void> {
    await this.#deps.pass.outbox.retryParked();
    this.#failuresInARow = 0;
    this.#forceOffline = true;
    await this.requestSync();
  }

  /** Starts a pass, or asks the running one to repeat. Never rejects. */
  requestSync(): Promise<void> {
    if (this.#running !== null) {
      this.#again = true;
      return this.#running;
    }
    this.#cancelRetry?.();
    this.#cancelRetry = null;
    const loop = this.#loop().finally(() => {
      this.#running = null;
    });
    this.#running = loop;
    return loop;
  }

  async #loop(): Promise<void> {
    try {
      let shouldRun = true;
      while (shouldRun) {
        this.#again = false;
        await this.#runOnce();
        shouldRun = this.#wasRepeatRequested();
      }
    } catch (error) {
      // The database itself failed: nothing is lost (events are saved before they are sent).
      this.#deps.report(error);
    }
  }

  // A method, so the flag is read again after the awaits (a pass may have asked for another).
  #wasRepeatRequested(): boolean {
    return this.#again;
  }

  async #runOnce(): Promise<void> {
    const force = this.#forceOffline;
    this.#forceOffline = false;
    const missing = this.#missingCondition();
    if (missing !== null) {
      await this.#refresh({ phase: "blocked", blockReason: missing, lastFailureCode: null });
      return;
    }
    if (!this.#snapshot.isOnline && !force) return;
    await this.#refresh({ phase: "syncing", blockReason: null });
    await this.#finish(await this.#attempt());
  }

  #missingCondition(): BlockReason | null {
    if (!this.#deps.hasServer()) return "noServer";
    return this.#deps.hasSession() ? null : "needsLogin";
  }

  async #attempt(): Promise<PassOutcome | null> {
    try {
      return await runSyncPass(this.#deps.pass, this.#passState);
    } catch (error) {
      this.#deps.report(error);
      return null;
    }
  }

  async #finish(outcome: PassOutcome | null): Promise<void> {
    if (outcome === null) return this.#retryLater({ countsAsFailure: true, code: "storage" });
    if (outcome.kind === "retry") return this.#retryLater(outcome);
    this.#failuresInARow = 0;
    if (outcome.kind === "blocked") {
      return this.#refresh({
        phase: "blocked",
        blockReason: outcome.reason,
        lastFailureCode: outcome.code,
      });
    }
    return this.#refresh({
      phase: "idle",
      lastFailureCode: null,
      lastSyncAt: await this.#deps.pass.kv.get(KV_KEYS.lastSyncAt),
    });
  }

  async #retryLater(outcome: {
    readonly delayMs?: number | null;
    readonly countsAsFailure: boolean;
    readonly code: string;
  }): Promise<void> {
    if (outcome.countsAsFailure) this.#failuresInARow += 1;
    const delayMs = outcome.delayMs ?? backoffDelayMs(this.#failuresInARow, this.#deps.random());
    this.#cancelRetry = this.#deps.schedule(() => {
      this.#cancelRetry = null;
      void this.requestSync();
    }, delayMs);
    await this.#refresh({ phase: "waitingRetry", lastFailureCode: outcome.code });
  }

  async #refresh(patch: Partial<SyncSnapshot>): Promise<void> {
    const counts = await this.#deps.pass.outbox.countByStatus();
    this.#publish({ ...patch, counts });
  }

  #publish(patch: Partial<SyncSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    for (const listener of this.#listeners) listener();
  }
}
