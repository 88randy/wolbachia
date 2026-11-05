import type { DraftPatch } from "./types.ts";
import type { OvitrapService, Snapshot } from "./service.ts";
export class ImmutableCaptureError extends Error {
  constructor() {
    super("The capture is immutable; pending edits were not saved.");
    this.name = "ImmutableCaptureError";
  }
}
/** Retryable writes retain input; immutable late edits are discarded and reported to the caller. */
export class OvitrapDraftBuffer {
  #pending: DraftPatch | null = null;
  #revision = 0;
  get revision(): number {
    return this.#revision;
  }
  edit(patch: DraftPatch): void {
    this.#revision++;
    this.#pending = { ...this.#pending, ...patch };
  }
  merge(snapshot: Snapshot): Snapshot {
    return snapshot.draft && !snapshot.event && this.#pending
      ? { ...snapshot, draft: { ...snapshot.draft, ...this.#pending } }
      : snapshot;
  }
  discard(): void {
    this.#pending = null;
    this.#revision++;
  }
  async persist(service: OvitrapService): Promise<void> {
    if (!this.#pending) return;
    const revision = this.#revision;
    const result = await service.update(this.#pending);
    if (!result.isUpdateApplied) {
      this.discard();
      throw new ImmutableCaptureError();
    }
    if (revision === this.#revision) this.discard();
  }
}
