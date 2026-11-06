import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import type { SyncPassDeps } from "../../sync/sync-pass.ts";
import { SerialQueue } from "./serial-queue.ts";
import type { DayStore } from "./store.ts";
import type { DayCache } from "./types.ts";

export type BundleResult =
  | { readonly kind: "bundle"; readonly body: unknown }
  | { readonly kind: "unchanged" }
  | { readonly kind: "revoked" };
export type ProjectionWriter = <Result>(write: () => Promise<Result>) => Promise<Result>;
export type BundleTransport = (etag: string | null) => Promise<BundleResult>;
interface Dependencies {
  readonly store: DayStore;
  readonly transport: BundleTransport;
  readonly now: () => Date;
  readonly getScopeKey?: () => string | null;
}
type SyncHooks = Pick<
  SyncPassDeps,
  "serializeProjectionPass" | "applyProjectionChanges" | "recoverProjections" | "revokeProjections"
>;

/** Network turns serialize sync against bootstrap. Auth end acquires ONLY the short projection
 * gate: SessionRequests can await it while the network turn is held. Scope is rechecked there. */
export class DayBundleService {
  readonly #deps: Dependencies;
  readonly #network = new SerialQueue();
  readonly #projections = new SerialQueue();
  readonly #listeners = new Set<(event: "updated" | "revoked") => void>();
  #isRevoked = false;
  #revocation = 0;
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  async read(): Promise<DayCache> {
    const empty: DayCache = { tasks: [], manifests: [], meta: null };
    const revocation = this.#revocation;
    if (this.#isRevoked) return empty;
    if (await this.#deps.store.needsCleanup()) {
      this.#invalidate();
      return empty;
    }
    const cached = await this.#deps.store.read();
    return revocation !== this.#revocation ? empty : cached;
  }
  subscribe = (listener: (event: "updated" | "revoked") => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  #publish(event: "updated" | "revoked" = "updated"): void {
    for (const listener of this.#listeners) listener(event);
  }
  #captureGuard(): () => void {
    const scope = this.#deps.getScopeKey?.();
    const revocation = this.#revocation;
    return () => {
      if (revocation !== this.#revocation) throw new RemoteSessionEnded();
      if (
        this.#deps.getScopeKey !== undefined &&
        (scope === null || this.#deps.getScopeKey() !== scope)
      )
        throw new RemoteSessionEnded();
    };
  }
  /** Capture before asynchronous work; only its brief local commits acquire the projection gate. */
  captureProjectionWriter(): ProjectionWriter {
    const assertCurrent = this.#captureGuard();
    return (write) =>
      this.#projections.run(() => {
        assertCurrent();
        return write();
      });
  }
  refresh(force = false): Promise<void> {
    return this.#network.run(async () => {
      await this.retryCleanup();
      await this.#refresh(force);
    });
  }
  async #refresh(force: boolean): Promise<void> {
    const write = this.captureProjectionWriter();
    const cached = await this.read();
    const requiresBody = force || (await this.#deps.store.needsBootstrap());
    const answer = await this.#deps.transport(
      requiresBody ? null : (cached.meta?.bundle_version ?? null),
    );
    if (answer.kind === "revoked") return this.clearSessionData();
    if (answer.kind === "unchanged") {
      return write(() => {
        if (requiresBody || cached.meta === null)
          throw new Error("Bootstrap recovery requires a body.");
        return Promise.resolve();
      });
    }
    await write(async () => {
      await this.#deps.store.replace(answer.body, this.#deps.now());
      this.#isRevoked = false;
      this.#publish();
    });
  }
  #apply(changes: unknown, write: ProjectionWriter): Promise<void> {
    return write(async () => {
      await this.#deps.store.applyChanges(changes);
      this.#publish();
    });
  }
  applyProjectionChanges = (changes: unknown): Promise<void> =>
    this.#network.run(() => this.#apply(changes, this.captureProjectionWriter()));
  #invalidate(): void {
    this.#revocation += 1;
    this.#isRevoked = true;
    this.#publish("revoked");
  }
  /** The durable auth-ended journal covers a final receipt until sync persists its results. */
  deferCleanup = (): Promise<void> => {
    this.#invalidate();
    return Promise.resolve();
  };
  clearForAuth = (hasFinalReceipt = false): Promise<void> =>
    hasFinalReceipt ? this.deferCleanup() : this.clearSessionData();
  /** Auth may own #network: only brief local writes acquire the projection gate. */
  clearSessionData = (): Promise<void> => {
    this.#invalidate();
    return this.#projections.run(async () => {
      await this.#deps.store.markCleanupPending();
      await this.#deps.store.revoke();
      this.#publish();
    });
  };
  /** Failed cleanup has a durable flag; retry before another sync/bootstrap or on auth startup. */
  retryCleanup = async (): Promise<void> => {
    if (await this.#deps.store.needsCleanup()) await this.clearSessionData();
  };
  revoke = (): Promise<void> => this.#network.run(this.clearSessionData);
  syncHooks(): SyncHooks {
    let write = this.captureProjectionWriter();
    return {
      serializeProjectionPass: (pass) =>
        this.#network.run(async () => {
          await this.retryCleanup();
          write = this.captureProjectionWriter();
          return pass();
        }),
      applyProjectionChanges: (changes) => this.#apply(changes, write),
      recoverProjections: () => this.#refresh(true),
      revokeProjections: this.clearSessionData,
    };
  }
  /** Local routing never waits for HTTP or adopts a previous session's selection. */
  withAssignments<T>(action: (cache: DayCache) => Promise<T>): Promise<T> {
    const assertCurrent = this.#captureGuard();
    return this.#projections.run(async () => {
      assertCurrent();
      const cache = await this.read();
      assertCurrent();
      return action(cache);
    });
  }
}
