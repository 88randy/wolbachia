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
export type TrackNotice = "locationDenied" | "notificationsDenied" | "unavailable" | null;

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
  readonly rules: () => Promise<TrackRules>;
  readonly texts: () => Promise<{ readonly title: string; readonly body: string }>;
  readonly versions: () => Promise<{ readonly rules: string; readonly catalog: string }>;
  readonly uuid: () => string;
  readonly now: () => number;
  readonly requestSync: () => void;
  readonly report: (event: string, error: unknown) => void;
}

interface Active {
  readonly owner: string;
  readonly shiftId: string;
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

  /** Background task callback. Fixes outside an open shift of the same owner are discarded. */
  onFixes(fixes: readonly RawFix[]): Promise<void> {
    return this.#serial(async () => {
      const active = this.#active;
      if (active === null) return;
      const owner = this.#deps.identity();
      const shiftId = await this.#deps.store.openShiftId();
      if (owner !== active.owner || shiftId !== active.shiftId) {
        await this.#reconcile();
        return;
      }
      const rules = await this.#deps.rules();
      const kept: TrackFix[] = [];
      for (const fix of [...fixes].sort((a, b) => a.at - b.at)) {
        if (!keepFix(active.last, fix, rules)) continue;
        kept.push(fix);
        active.last = fix;
      }
      await this.#deps.store.append(active.owner, active.shiftId, kept);
      if (kept.length > 0) this.#publish({ revision: this.#snapshot.revision + 1 });
      if (this.#deps.now() - active.lastCutAt >= rules.uploadIntervalSeconds * 1000)
        await this.#cut(active.owner);
    });
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
    const shiftId = owner === null ? null : await store.openShiftId();
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
    if (this.#active === null) {
      this.#active = {
        owner,
        shiftId,
        last: await store.lastKept(owner, shiftId),
        lastCutAt: this.#deps.now(),
      };
      this.#publish({ revision: this.#snapshot.revision + 1 });
    }
    if (await this.#deps.native.isRunning()) return;
    await this.#start();
  }

  /** Outside a shift: flush what is left (local, works offline), then stop the service. */
  async #stop(owner: string | null): Promise<void> {
    if (owner !== null) await this.#cut(owner);
    if (await this.#deps.native.isRunning()) await this.#deps.native.stop();
    this.#publish({ notice: null });
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
