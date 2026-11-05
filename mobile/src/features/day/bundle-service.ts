import type { DayStore } from "./store.ts";
import type { DayCache } from "./types.ts";
import type { SyncPassDeps } from "../../sync/sync-pass.ts";
import { SerialQueue } from "./serial-queue.ts";
export type BundleResult =
  | { readonly kind: "bundle"; readonly body: unknown }
  | { readonly kind: "unchanged" }
  | { readonly kind: "revoked" };
export type BundleTransport = (etag: string | null) => Promise<BundleResult>;
interface Dependencies {
  readonly store: DayStore;
  readonly transport: BundleTransport;
  readonly now: () => Date;
}
type SyncHooks = Pick<
  SyncPassDeps,
  "serializeProjectionPass" | "applyProjectionChanges" | "recoverProjections" | "revokeProjections"
>;
/** Network turns serialize bootstrap against a whole sync pass. Short projection turns also arbitrate local navigation against revocation.
 * Cached reads and enqueue never acquire the network queue. Internal recovery must not reacquire its own network turn. */
export class DayBundleService {
  readonly #deps: Dependencies;
  readonly #network = new SerialQueue();
  readonly #projections = new SerialQueue();
  constructor(deps: Dependencies) {
    this.#deps = deps;
  }
  read() {
    return this.#deps.store.read();
  }
  refresh(force = false): Promise<void> {
    return this.#network.run(() => this.#refresh(force));
  }
  async #refresh(force: boolean): Promise<void> {
    const cached = await this.read();
    const answer = await this.#deps.transport(force ? null : (cached.meta?.bundle_version ?? null));
    if (answer.kind === "revoked") return this.#projections.run(() => this.#deps.store.revoke());
    if (answer.kind === "unchanged") {
      if (force || cached.meta === null) throw new Error("Bootstrap recovery requires a body.");
      return;
    }
    await this.#projections.run(() => this.#deps.store.replace(answer.body, this.#deps.now()));
  }
  applyProjectionChanges = (changes: unknown): Promise<void> =>
    this.#network.run(() => this.#projections.run(() => this.#deps.store.applyChanges(changes)));
  revoke = (): Promise<void> =>
    this.#network.run(() => this.#projections.run(() => this.#deps.store.revoke()));
  /** Only runSyncPass invokes these hooks, inside its serialized network turn. */
  syncHooks(): SyncHooks {
    return {
      serializeProjectionPass: (pass) => this.#network.run(pass),
      applyProjectionChanges: (changes) =>
        this.#projections.run(() => this.#deps.store.applyChanges(changes)),
      recoverProjections: () => this.#refresh(true),
      revokeProjections: () => this.#projections.run(() => this.#deps.store.revoke()),
    };
  }
  /** Resolve local routing and commit navigation under the same short gate as projection writes, without waiting for HTTP. */
  withAssignments<T>(action: (cache: DayCache) => Promise<T>): Promise<T> {
    return this.#projections.run(async () => action(await this.read()));
  }
}
