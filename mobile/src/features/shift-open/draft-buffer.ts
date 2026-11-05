import { OutboxWriteError } from "../../outbox/outbox-repository.ts";
import type { OpenShiftDraft } from "./domain.ts";
import type { ShiftOpenService, ShiftSnapshot } from "./service.ts";
export type DraftPatch = Partial<
  Pick<OpenShiftDraft, "motorcycle_code" | "checks" | "odometer_km" | "note" | "step">
>;
/** Uncommitted inputs survive failed writes and unrelated sync refreshes; only the matching save clears them. */
export class DraftBuffer {
  #pending: DraftPatch | null = null;
  #revision = 0;
  get revision(): number {
    return this.#revision;
  }
  edit(patch: DraftPatch): void {
    this.#revision += 1;
    this.#pending = { ...this.#pending, ...patch };
  }
  merge(snapshot: ShiftSnapshot): ShiftSnapshot {
    if (snapshot.draft === null || this.#pending === null || snapshot.opening !== null)
      return snapshot;
    return { ...snapshot, draft: { ...snapshot.draft, ...this.#pending } };
  }
  async persist(service: ShiftOpenService): Promise<void> {
    if (this.#pending === null) return;
    const token = this.#revision;
    try {
      await service.update(this.#pending);
    } catch (error) {
      throw new OutboxWriteError(error);
    }
    if (token === this.#revision) {
      this.#pending = null;
      this.#revision += 1;
    }
  }
}
