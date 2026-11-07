import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import type { SyncPassDeps } from "../../sync/sync-pass.ts";
import { SerialQueue } from "./serial-queue.ts";
import type { DayStore } from "./store.ts";
import type { DayCache } from "./types.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";

export type BundleResult =
  | { readonly kind: "bundle"; readonly body: unknown }
  | { readonly kind: "unchanged" }
  | { readonly kind: "revoked" };
export type ProjectionWriter = <Result>(write: () => Promise<Result>) => Promise<Result>;
interface ProjectionTurn {
  readonly write: ProjectionWriter;
  readonly handle: CaptureTransportHandle | null;
}
export type BundleTransport = (etag: string | null) => Promise<BundleResult>;
interface Dependencies {
  readonly store: DayStore;
  readonly transport: BundleTransport;
  readonly now: () => Date;
  readonly getScopeKey?: () => string | null;
  readonly getCaptureIdentity?: () => EvidenceIdentity | null;
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
  async #captureTurn(): Promise<ProjectionTurn> {
    const assertCurrent = this.#captureGuard();
    const original = this.#deps.getCaptureIdentity?.() ?? null;
    const identity =
      original === null ? null : { owner: { ...original.owner }, sessionId: original.sessionId };
    const current = () => {
      assertCurrent();
      const next = this.#deps.getCaptureIdentity?.() ?? null;
      return identity === null
        ? next === null
        : next !== null &&
            identity.sessionId === next.sessionId &&
            ownerKey(identity.owner) === ownerKey(next.owner);
    };
    const write = this.captureProjectionWriter();
    const handle = await write(() => this.#deps.store.captureTransport(identity, current));
    if (!current()) throw new RemoteSessionEnded();
    return { write, handle };
  }
  refresh(force = false): Promise<void> {
    return this.#network.run(async () => {
      await this.retryCleanup();
      await this.#refresh(force);
    });
  }
  async #refresh(force: boolean, original?: ProjectionTurn): Promise<ProjectionTurn | null> {
    const turn = original ?? (await this.#captureTurn());
    const { write, handle } = turn;
    if (handle !== null && !handle.isCurrent()) throw new RemoteSessionEnded();
    const cached = await this.read();
    const requiresBody = await this.#requiresBody(force, handle);
    const answer = await this.#deps.transport(
      requiresBody ? null : (cached.meta?.bundle_version ?? null),
    );
    if (answer.kind === "revoked") {
      await this.clearSessionData();
      return null;
    }
    if (answer.kind === "unchanged") {
      return write(() => {
        if (requiresBody || cached.meta === null)
          throw new Error("Bootstrap recovery requires a body.");
        return Promise.resolve(turn);
      });
    }
    return this.#replace(answer.body, turn);
  }
  async #requiresBody(force: boolean, handle: CaptureTransportHandle | null): Promise<boolean> {
    const consumesLifecycle = this.#deps.getCaptureIdentity !== undefined;
    if (consumesLifecycle && (handle === null || handle.scopeRevision === null)) return true;
    return force || (await this.#deps.store.needsBootstrap(consumesLifecycle));
  }
  #replace(body: unknown, turn: ProjectionTurn): Promise<ProjectionTurn> {
    return turn.write(async () => {
      await this.#deps.store.replace(body, this.#deps.now(), turn.handle);
      const handle = await this.#deps.store.advanceCaptureTransport(turn.handle);
      this.#isRevoked = false;
      this.#publish();
      return { write: turn.write, handle };
    });
  }
  #apply(changes: unknown, turn: ProjectionTurn): Promise<ProjectionTurn> {
    return turn.write(async () => {
      await this.#deps.store.applyChanges(changes, turn.handle);
      const handle = await this.#deps.store.advanceCaptureTransport(turn.handle);
      this.#publish();
      return { write: turn.write, handle };
    });
  }
  applyProjectionChanges = (changes: unknown): Promise<void> =>
    this.#network.run(async () => {
      await this.#apply(changes, await this.#captureTurn());
    });
  #invalidate(): void {
    this.#revocation += 1;
    this.#isRevoked = true;
    this.#publish("revoked");
  }
  /** The durable auth-ended journal covers a final receipt until sync persists its results. */
  deferCleanup = (): Promise<void> => {
    this.#invalidate();
    return this.#projections.run(() => this.#deps.store.markCleanupPending());
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
    let turn: ProjectionTurn = {
      write: this.captureProjectionWriter(),
      handle: null,
    };
    return {
      serializeProjectionPass: (pass) =>
        this.#network.run(async () => {
          await this.retryCleanup();
          turn = await this.#captureTurn();
          return pass();
        }),
      applyProjectionChanges: async (changes) => {
        turn = await this.#apply(changes, turn);
      },
      recoverProjections: async () => {
        const recovered = await this.#refresh(true, turn);
        if (recovered === null) throw new RemoteSessionEnded();
        turn = recovered;
      },
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
