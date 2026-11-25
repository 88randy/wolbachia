import { dayEndAfter } from "./day-end.ts";
import type { TrackFix } from "./simplify-track.ts";
import { keepFix } from "./track-filter.ts";
import type { RawFix } from "./track-filter.ts";
import type { TrackRules } from "./track-rules.ts";
import type { TrackStore } from "./track-store.ts";

/** What the native background task needs to start; the texts are already translated. */
export interface TrackStartOptions {
  readonly isHighAccuracy: boolean;
  readonly timeIntervalMs: number;
  readonly notificationTitle: string;
  readonly notificationBody: string;
}

/** The Android boundary (expo-location task + permissions), injected so tests drive it by hand. */
export interface NativeTrackApi {
  /** Location permission is required; notifications only make the service visible. */
  prepare(): Promise<{
    readonly isLocationGranted: boolean;
    readonly isNotificationGranted: boolean;
  }>;
  start(options: TrackStartOptions): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
}

/** Non-blocking reasons the track is not (fully) recorded. Work never waits on them. */
export type TrackNotice =
  "locationDenied" | "notificationsDenied" | "unavailable" | "dayEnded" | null;

/**
 * [ASSUMPTION] Technical batching, not a business rule: unsent points that only hold stillness
 * heartbeats wait until the oldest is this old, so a still hour is one segment instead of twelve.
 */
export const IDLE_CUT_MS = 60 * 60_000;

export interface TrackSnapshot {
  /** Bumped after every local change, so the map reloads its line. */
  readonly revision: number;
  readonly notice: TrackNotice;
}

export interface TrackRecorderDeps {
  readonly store: TrackStore;
  readonly native: NativeTrackApi;
  /** Owner key of the signed-in courier; null once the session ended (logout, revocation). */
  readonly identity: () => string | null;
  /** IANA zone of the signed-in organization; null falls back to the device zone. */
  readonly timeZone: () => string | null;
  readonly rules: () => Promise<TrackRules>;
  readonly texts: () => Promise<{ readonly title: string; readonly body: string }>;
  readonly versions: () => Promise<{ readonly rules: string; readonly catalog: string }>;
  readonly uuid: () => string;
  readonly now: () => number;
  readonly requestSync: () => void;
  readonly report: (event: string, error: unknown) => void;
}

/**
 * Runs `reconcile` whenever `key()` changes. With key = auth phase + owner this covers login,
 * unlock, late profile hydration on a cold start, logout, revocation and owner change.
 */
export function reconcileOnChange(input: {
  readonly subscribe: (listener: () => void) => () => void;
  readonly key: () => string;
  readonly reconcile: () => Promise<void>;
}): () => void {
  let last = input.key();
  return input.subscribe(() => {
    const next = input.key();
    if (next === last) return;
    last = next;
    void input.reconcile();
  });
}

interface Active {
  readonly owner: string;
  readonly shiftId: string;
  readonly openedAt: number;
  last: TrackFix | null;
  lastCutAt: number;
}

/**
 * Records the courier track only between a local shift open and close. ONE serialized queue runs
 * reconcile, fixes and cuts, so a cut never races an append and start/stop never interleave.
 * `reconcile` is the single entry for every trigger (open, close, logout, revocation, owner
 * change, app start, foreground): it reads the durable shift and session and starts or stops.
 */
export class TrackRecorder {
  readonly #deps: TrackRecorderDeps;
  readonly #listeners = new Set<() => void>();
  #tail: Promise<unknown> = Promise.resolve();
  #active: Active | null = null;
  #snapshot: TrackSnapshot = { revision: 0, notice: null };

  constructor(deps: TrackRecorderDeps) {
    this.#deps = deps;
  }

  getSnapshot = (): TrackSnapshot => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** The local points of the open shift (P10 draws them as a line); empty outside a shift. */
  currentLine(): Promise<readonly TrackFix[]> {
    const active = this.#active;
    return active === null
      ? Promise.resolve([])
      : this.#deps.store.listForShift(active.owner, active.shiftId);
  }

  reconcile = (): Promise<void> => this.#serial(() => this.#reconcile());

  /**
   * Background task callback. A deferred batch can arrive after the close: its fixes up to the
   * close still belong to the owner's last shift; everything else outside an open shift of the
   * same owner is discarded.
   */
  onFixes(fixes: readonly RawFix[]): Promise<void> {
    return this.#serial(async () => {
      const owner = this.#deps.identity();
      const active = this.#active;
      if (active !== null && owner !== null) {
        const shiftId = await this.#deps.store.openShiftId(owner);
        if (owner === active.owner && shiftId === active.shiftId) {
          await this.#record(active, fixes);
          return;
        }
      }
      if (active !== null) await this.#reconcile();
      if (owner !== null) await this.#recordLate(owner, fixes);
    });
  }

  async #record(active: Active, fixes: readonly RawFix[]): Promise<void> {
    const rules = await this.#deps.rules();
    const endsAt = this.#dayEnd(active, rules);
    const kept = this.#filter(
      active,
      fixes.filter((fix) => fix.at < endsAt),
      rules,
    );
    await this.#deps.store.append(active.owner, active.shiftId, kept);
    if (kept.length > 0) this.#publish({ revision: this.#snapshot.revision + 1 });
    if (this.#deps.now() >= endsAt) await this.#stop(active.owner, "dayEnded");
    else if (await this.#isCutDue(active, rules)) await this.#cut(active.owner);
  }

  #dayEnd(active: Active, rules: TrackRules): number {
    return dayEndAfter(active.openedAt, rules.dayEndMinutes, this.#deps.timeZone());
  }

  /** Moving points go every upload interval; heartbeat-only points wait for IDLE_CUT_MS. */
  async #isCutDue(active: Active, rules: TrackRules): Promise<boolean> {
    const now = this.#deps.now();
    if (now - active.lastCutAt < rules.uploadIntervalSeconds * 1000) return false;
    const unsent = await this.#deps.store.unsent(active.owner, active.shiftId);
    const first = unsent[0];
    if (first === undefined) return false;
    const heartbeatMs = rules.stillHeartbeatSeconds * 1000;
    // The filter keeps a fix sooner than a heartbeat only when it moved.
    const hasMoved = unsent.some(
      (point, index) => index > 0 && point.at - (unsent[index - 1]?.at ?? 0) < heartbeatMs,
    );
    return hasMoved || now - first.at >= IDLE_CUT_MS;
  }

  /** Fixes up to the close of the owner's last (closed) shift, then cut at once. */
  async #recordLate(owner: string, fixes: readonly RawFix[]): Promise<void> {
    const { store } = this.#deps;
    const shiftId = await store.lastShiftOf(owner);
    if (shiftId === null) return;
    const closedAt = await store.closedAt(shiftId);
    if (!Number.isFinite(closedAt)) return;
    const late = { last: await store.lastKept(owner, shiftId) };
    const inShift = fixes.filter((fix) => fix.at <= closedAt);
    const kept = this.#filter(late, inShift, await this.#deps.rules());
    if (kept.length === 0) return;
    await store.append(owner, shiftId, kept);
    await this.#cut(owner);
  }

  #filter(active: Pick<Active, "last">, fixes: readonly RawFix[], rules: TrackRules): TrackFix[] {
    const kept: TrackFix[] = [];
    for (const fix of [...fixes].sort((a, b) => a.at - b.at)) {
      if (!keepFix(active.last, fix, rules)) continue;
      kept.push(fix);
      active.last = fix;
    }
    return kept;
  }

  #serial(action: () => Promise<void>): Promise<void> {
    const next = this.#tail.then(action).catch((error: unknown) => {
      this.#deps.report("track.failed", error);
    });
    this.#tail = next;
    return next;
  }

  async #reconcile(): Promise<void> {
    const { store } = this.#deps;
    await store.prune(this.#deps.now());
    const owner = this.#deps.identity();
    const shiftId = owner === null ? null : await store.openShiftId(owner);
    const previous = this.#active;
    if (previous !== null && (previous.owner !== owner || previous.shiftId !== shiftId)) {
      this.#active = null;
      this.#publish({ revision: this.#snapshot.revision + 1 });
      await this.#cut(previous.owner);
    }
    if (owner === null || shiftId === null) {
      await this.#stop(owner);
      return;
    }
    const active = this.#active ?? (await this.#activate(owner, shiftId));
    // Owner decision (#371): a shift left open stops recording at its day end; never restarts.
    if (this.#deps.now() >= this.#dayEnd(active, await this.#deps.rules())) {
      await this.#stop(owner, "dayEnded");
      return;
    }
    if (await this.#deps.native.isRunning()) return;
    await this.#start();
  }

  async #activate(owner: string, shiftId: string): Promise<Active> {
    const { store } = this.#deps;
    const active: Active = {
      owner,
      shiftId,
      openedAt: await store.openedAt(shiftId),
      last: await store.lastKept(owner, shiftId),
      lastCutAt: this.#deps.now(),
    };
    this.#active = active;
    this.#publish({ revision: this.#snapshot.revision + 1 });
    return active;
  }

  /** Outside a shift or past its day end: flush what is left (local, offline), stop the service. */
  async #stop(owner: string | null, notice: TrackNotice = null): Promise<void> {
    if (owner !== null) await this.#cut(owner);
    if (await this.#deps.native.isRunning()) await this.#deps.native.stop();
    this.#publish({ notice });
  }

  async #start(): Promise<void> {
    const { native } = this.#deps;
    const permissions = await native.prepare();
    if (!permissions.isLocationGranted) {
      this.#publish({ notice: "locationDenied" });
      return;
    }
    const rules = await this.#deps.rules();
    const texts = await this.#deps.texts();
    try {
      await native.start({
        isHighAccuracy: rules.isHighAccuracy,
        timeIntervalMs: rules.sampleIntervalSeconds * 1000,
        notificationTitle: texts.title,
        notificationBody: texts.body,
      });
    } catch (error) {
      // Android refuses a foreground service started from the background: retried on the next foreground.
      this.#deps.report("track.start_failed", error);
      this.#publish({ notice: "unavailable" });
      return;
    }
    this.#publish({ notice: permissions.isNotificationGranted ? null : "notificationsDenied" });
  }

  async #cut(owner: string): Promise<void> {
    const rules = await this.#deps.rules();
    const count = await this.#deps.store.cut({
      owner,
      rules,
      uuid: this.#deps.uuid,
      now: this.#deps.now,
      versions: await this.#deps.versions(),
    });
    if (this.#active !== null) this.#active.lastCutAt = this.#deps.now();
    if (count > 0) this.#deps.requestSync();
  }

  #publish(change: Partial<TrackSnapshot>): void {
    const next = { ...this.#snapshot, ...change };
    if (next.revision === this.#snapshot.revision && next.notice === this.#snapshot.notice) return;
    this.#snapshot = next;
    for (const listener of this.#listeners) listener();
  }
}
