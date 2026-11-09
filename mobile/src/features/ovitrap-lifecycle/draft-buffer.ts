import type { DraftPatch } from "./types.ts";
import type { LifecycleService, Snapshot } from "./service.ts";
import { ImmutableCaptureError, StaleCaptureError } from "./capture-identity.ts";
export { ImmutableCaptureError } from "./capture-identity.ts";
/** Pending input belongs to one event UUID; changing captures discards it with an explicit notice. */
export class LifecycleDraftBuffer {
  #eventId: string | null = null;
  #pending: DraftPatch | null = null;
  #revision = 0;
  #hasDiscardedEdits = false;
  get revision(): number {
    return this.#revision;
  }
  edit(eventId: string, patch: DraftPatch): void {
    this.rebind(eventId);
    this.#revision++;
    this.#pending = { ...this.#pending, ...patch };
  }
  rebind(eventId: string | null): void {
    if (eventId === this.#eventId) return;
    this.#discardWithNotice();
    this.#eventId = eventId;
  }
  merge(snapshot: Snapshot): Snapshot {
    this.rebind(snapshot.draft?.eventId ?? null);
    if (snapshot.event) this.#discardWithNotice();
    return snapshot.draft && this.#pending
      ? { ...snapshot, draft: { ...snapshot.draft, ...this.#pending } }
      : snapshot;
  }
  takeDiscardedEditNotice(): boolean {
    const hasDiscardedEdits = this.#hasDiscardedEdits;
    this.#hasDiscardedEdits = false;
    return hasDiscardedEdits;
  }
  #discardWithNotice(): void {
    this.#hasDiscardedEdits ||= this.#pending !== null;
    this.#discard();
  }
  #discard(): void {
    this.#pending = null;
    this.#revision++;
  }
  async persist(service: LifecycleService, eventId = this.#eventId): Promise<void> {
    if (!this.#pending) return;
    if (eventId !== this.#eventId) throw new StaleCaptureError();
    const revision = this.#revision;
    try {
      const result = await service.update(this.#pending, eventId);
      if (!result.isUpdateApplied) throw new ImmutableCaptureError();
      if (revision === this.#revision) this.#discard();
    } catch (error) {
      if (error instanceof ImmutableCaptureError && eventId === this.#eventId) this.#discard();
      throw error;
    }
  }
}
