import { RemoteSessionEnded } from "../../auth/session-requests.ts";
import type { SyncPassDeps } from "../../sync/sync-pass.ts";
import { SerialQueue } from "./serial-queue.ts";
import type { DayStore } from "./store.ts";
import type { DayCache } from "./types.ts";
import type { TaskOwner } from "./current-task.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";
import type { LifecycleSourceReader } from "../ovitrap-lifecycle/source-context.ts";
import type { LifecycleSourceRequest, LifecycleAdmission } from "../ovitrap-lifecycle/types.ts";
import { LifecycleGateError } from "../ovitrap-lifecycle/action-error-key.ts";
import type { SupplyProjectionSource } from "../supply-receipt/projection-types.ts";
import { SupplyProjectionUnavailable } from "../supply-receipt/projection-types.ts";
import type { FuelCaptureSource } from "../fuel/capture-context.ts";
import { FuelError } from "../fuel/domain.ts";
import { ReleaseProjectionUnavailable } from "../releases/projections.ts";
import type { ReleaseProjectionSource } from "../releases/projections.ts";
import { SampleProjectionUnavailable } from "../samples/projection.ts";
import type { SampleProjectionSource } from "../samples/projection.ts";

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
  readonly getTransportKey?: () => string | null;
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
    if (this.#isRevoked || this.#deps.getScopeKey?.() === null) return empty;
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
  /** Neither the network queue nor the short SQL writer owns the consumer's factory/native work. */
  captureLifecycleSource(): LifecycleSourceReader {
    const original = this.#captureTurn();
    void original.catch(() => undefined); // Abandoned requests still own their read error.
    return async (request, use) => {
      const turn = await original;
      if (turn.handle === null) throw new LifecycleGateError("scope");
      const handle = turn.handle;
      const source = await turn.write(() => this.#deps.store.lifecycleSource(handle, request));
      if (!handle.isCurrent()) throw new LifecycleGateError("scope");
      return use({ ...source, write: turn.write, ...this.#lifecycleContinuations(turn, source) });
    };
  }
  async #readLifecycleCurrent(
    turn: ProjectionTurn,
    source: Awaited<ReturnType<DayStore["lifecycleSource"]>>,
    next: LifecycleSourceRequest | null,
  ) {
    const current = await turn.write(() => this.#deps.store.lifecycleSource(source.handle, next));
    if (
      current.ownerFence.ownerKey !== source.ownerFence.ownerKey ||
      current.ownerFence.sessionId !== source.ownerFence.sessionId ||
      current.ownerFence.generation !== source.ownerFence.generation ||
      !source.handle.isCurrent()
    )
      throw new LifecycleGateError("scope");
    return current;
  }
  #lifecycleContinuations(
    turn: ProjectionTurn,
    source: Awaited<ReturnType<DayStore["lifecycleSource"]>>,
  ) {
    return {
      resolve: async (next: LifecycleSourceRequest) => {
        const current = await this.#readLifecycleCurrent(turn, source, next);
        if (current.source === null) throw new LifecycleGateError("scope");
        return current.source;
      },
      assertCurrent: async () => {
        await this.#readLifecycleCurrent(turn, source, null);
      },
    };
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
    if (force || (await this.#deps.store.needsBootstrap(consumesLifecycle))) return true;
    if (!consumesLifecycle) return false;
    const { store } = this.#deps;
    return (
      (await store.needsReleaseBootstrap()) ||
      (await store.needsSampleBootstrap()) ||
      (await store.needsSupplyBootstrap())
    );
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
  #captureTransportGuard(): () => void {
    const read = this.#deps.getTransportKey ?? this.#deps.getScopeKey;
    const original = read?.();
    return () => {
      if (read !== undefined && (original === null || read() !== original))
        throw new RemoteSessionEnded();
    };
  }
  #clearTransportProjections(assertSession: () => void): Promise<void> {
    return this.#projections.run(async () => {
      assertSession();
      this.#invalidate();
      await this.#deps.store.markCleanupPending();
      assertSession();
      await this.#deps.store.revoke();
      this.#publish();
    });
  }
  #suspendCaptureForRecovery(turn: ProjectionTurn): Promise<ProjectionTurn> {
    return turn.write(async () => {
      await this.#deps.store.suspendCaptureForRecovery(turn.handle);
      const handle = await this.#deps.store.advanceCaptureTransport(turn.handle);
      this.#publish();
      return { ...turn, handle };
    });
  }
  syncHooks(): SyncHooks {
    let assertSession = this.#captureTransportGuard();
    let turn: ProjectionTurn = {
      write: this.captureProjectionWriter(),
      handle: null,
    };
    return {
      serializeProjectionPass: (pass) =>
        this.#network.run(async () => {
          await this.retryCleanup();
          assertSession = this.#captureTransportGuard();
          assertSession();
          turn =
            this.#deps.getScopeKey?.() === null
              ? { handle: null, write: () => Promise.reject(new RemoteSessionEnded()) }
              : await this.#captureTurn();
          return pass();
        }),
      applyProjectionChanges: async (changes) => {
        turn = await this.#apply(changes, turn);
      },
      recoverProjections: async () => {
        turn = await this.#suspendCaptureForRecovery(turn);
        const recovered = await this.#refresh(true, turn);
        if (recovered === null) throw new RemoteSessionEnded();
        turn = recovered;
      },
      revokeProjections: () => this.#clearTransportProjections(assertSession),
    };
  }
  /** Local routing never waits for HTTP or adopts a previous session's selection. */
  withCurrentTask<T>(
    id: string,
    expected: TaskOwner,
    action: { readonly admission: LifecycleAdmission; readonly sqlOnly: () => Promise<T> },
  ): Promise<T> {
    const assertCurrent = this.#captureGuard();
    return action.admission.commit(async () => {
      assertCurrent();
      const task = await this.#deps.store.currentTask(id, expected);
      assertCurrent();
      action.admission.assertCurrent();
      if (!task) throw new LifecycleGateError("scope");
      return action.sqlOnly();
    });
  }
  withAssignments<T>(action: (cache: DayCache) => Promise<T>): Promise<T> {
    const assertCurrent = this.#captureGuard();
    return this.#projections.run(async () => {
      assertCurrent();
      const cache = await this.read();
      assertCurrent();
      return action(cache);
    });
  }
  /** Supply capture shares the existing short writer, original identity and durable projection CAS. */
  async withSupplyAssignments<T>(
    action: (source: SupplyProjectionSource) => Promise<T>,
  ): Promise<T> {
    const turn = await this.#captureTurn();
    if (turn.handle === null)
      throw new SupplyProjectionUnavailable("Supply capture context unavailable.");
    const handle = turn.handle;
    return turn.write(async () => {
      const source = await this.#deps.store.supplyAssignments(handle);
      if (!handle.isCurrent())
        throw new SupplyProjectionUnavailable("Supply capture context unavailable.");
      return action(source);
    });
  }
  /** Fuel capture shares the current downloaded context and the same short SQL writer. */
  async withFuelContext<T>(action: (source: FuelCaptureSource) => Promise<T>): Promise<T> {
    const turn = await this.#captureTurn();
    if (turn.handle === null) throw new FuelError("scope");
    const handle = turn.handle;
    return turn.write(async () => {
      const source = await this.#deps.store.fuelCaptureContext(handle);
      if (!handle.isCurrent()) throw new FuelError("scope");
      return action(source);
    });
  }
  /** Sample reads share the original owner, short projection writer and raw revision guard. */
  async withSampleProjection<T>(
    action: (source: SampleProjectionSource) => Promise<T>,
  ): Promise<T> {
    const turn = await this.#captureTurn();
    if (turn.handle === null) throw new SampleProjectionUnavailable();
    const handle = turn.handle;
    return turn.write(async () => {
      const source = await this.#deps.store.sampleProjection(handle);
      if (!handle.isCurrent()) throw new SampleProjectionUnavailable();
      return action(source);
    });
  }
  /** Release reads use the same original identity, projection gate and raw SQL revision guard. */
  async withReleaseProjection<T>(
    action: (source: ReleaseProjectionSource) => Promise<T>,
  ): Promise<T> {
    const turn = await this.#captureTurn();
    if (turn.handle === null)
      throw new ReleaseProjectionUnavailable("Release context unavailable.");
    const handle = turn.handle;
    return turn.write(async () => {
      const source = await this.#deps.store.releaseProjection(handle);
      if (!handle.isCurrent())
        throw new ReleaseProjectionUnavailable("Release context unavailable.");
      return action(source);
    });
  }
}
