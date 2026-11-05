import type { DraftPatch } from "./types.ts";
import type { OvitrapService, Snapshot } from "./service.ts";
export class ImmutableCaptureError extends Error {
  constructor() {
    super("The capture is immutable; pending edits were not saved.");
    this.name = "ImmutableCaptureError";
  }
}
/** Failed or newer keystrokes survive sync refreshes; only a matching successful write clears them. */
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
  async persist(service: OvitrapService): Promise<void> {
    if (!this.#pending) return;
    const revision = this.#revision;
    const result = await service.update(this.#pending);
    if (!result.isUpdateApplied) throw new ImmutableCaptureError();
    if (revision === this.#revision) {
      this.#pending = null;
      this.#revision++;
    }
  }
}
