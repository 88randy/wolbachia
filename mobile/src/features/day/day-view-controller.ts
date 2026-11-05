import { ApiError } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { buildDay } from "./domain.ts";
import { refreshDay } from "./refresh-day.ts";
import type { DayService, DaySnapshot } from "./service.ts";

export type DayErrorScope = "read" | "refresh" | "map" | "action";
export interface DayFailure {
  readonly key: MessageKey;
  readonly code: string | null;
}
export interface DayViewState {
  readonly state: DaySnapshot | null;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly isMapLoading: boolean;
  readonly isActing: boolean;
  readonly errors: Readonly<Record<DayErrorScope, DayFailure | null>>;
}
type ViewService = Pick<DayService, "read" | "verifyMap" | "bundle">;

/** Monotonic reads and single-flight refreshes retain cache and keep each failed action retryable. */
export class DayViewController {
  readonly #day: ViewService;
  readonly #listeners = new Set<() => void>();
  #revision = 0;
  #isActive = true;
  #refreshing: Promise<void> | null = null;
  #retryAction: (() => Promise<unknown>) | null = null;
  #snapshot: DayViewState = {
    state: null,
    isLoading: true,
    isRefreshing: false,
    isMapLoading: true,
    isActing: false,
    errors: { read: null, refresh: null, map: null, action: null },
  };
  constructor(day: ViewService) {
    this.#day = day;
  }
  getSnapshot = (): DayViewState => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  start(): void {
    this.#isActive = true;
  }
  stop(): void {
    this.#isActive = false;
    this.#revision += 1;
  }
  #patch(change: Partial<DayViewState>): void {
    if (!this.#isActive) return;
    this.#snapshot = { ...this.#snapshot, ...change };
    for (const listener of this.#listeners) listener();
  }
  #error(scope: DayErrorScope, key: MessageKey, error?: unknown): void {
    const failure =
      error === undefined ? null : { key, code: error instanceof ApiError ? error.code : null };
    this.#patch({ errors: { ...this.#snapshot.errors, [scope]: failure } });
  }
  load = async (): Promise<void> => {
    const revision = ++this.#revision;
    if (this.#snapshot.state === null) this.#patch({ isLoading: true });
    try {
      const state = await this.#day.read();
      if (revision !== this.#revision) return;
      this.#patch({ state, isLoading: false });
      this.#error("read", "mobile.day.readFailed");
    } catch (error) {
      if (revision !== this.#revision) return;
      this.#patch({ isLoading: false });
      this.#error("read", "mobile.day.readFailed", error);
    }
  };
  refresh = (): Promise<void> => {
    if (this.#refreshing !== null) return this.#refreshing;
    this.#patch({ isRefreshing: true });
    this.#error("refresh", "mobile.day.refreshFailed");
    const pending = this.#refresh().finally(() => {
      this.#refreshing = null;
      this.#patch({ isRefreshing: false, isMapLoading: false });
    });
    this.#refreshing = pending;
    return pending;
  };
  async #refresh(): Promise<void> {
    try {
      await refreshDay(this.#day, async () => {
        await this.load();
        this.#patch({ isMapLoading: false });
      });
    } catch (error) {
      this.#error("refresh", "mobile.day.refreshFailed", error);
    }
  }
  retryMap = async (): Promise<void> => {
    this.#patch({ isMapLoading: true });
    this.#error("map", "mobile.day.mapFailed");
    try {
      await this.#day.verifyMap(true);
      await this.load();
    } catch (error) {
      this.#error("map", "mobile.day.mapFailed", error);
    } finally {
      this.#patch({ isMapLoading: false });
    }
  };
  run = async (action: () => Promise<unknown>): Promise<void> => {
    if (this.#snapshot.isActing) return;
    this.#retryAction = action;
    this.#patch({ isActing: true });
    this.#error("action", "mobile.day.actionFailed");
    try {
      await action();
      this.#retryAction = null;
      await this.load();
    } catch (error) {
      this.#error("action", "mobile.day.actionFailed", error);
    } finally {
      this.#patch({ isActing: false });
    }
  };
  retryAction = (): Promise<void> =>
    this.#retryAction === null ? Promise.resolve() : this.run(this.#retryAction);
}

/** An unknown/failed local read must never render as a successful empty assignment list. */
export function dayViewPhase(
  view: DayViewState,
): "loading" | "error" | "empty" | "complete" | "content" {
  if (view.state === null) return view.isLoading ? "loading" : "error";
  const day = buildDay({
    tasks: view.state.tasks,
    work: view.state.work,
    location: { kind: "unavailable" },
    now: new Date(0),
  });
  if (day.total === 0) return "empty";
  return day.reviewed === day.total ? "complete" : "content";
}
