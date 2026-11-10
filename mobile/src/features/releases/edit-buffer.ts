import type { ReleaseState } from "./types.ts";

interface PendingQuantity {
  readonly quantity: string;
  readonly write: () => Promise<void>;
}
const BUFFERS = new WeakMap<object, ReleaseEditBuffer>();
/** Retain failed raw input across a screen remount for this same local service. */
export function releaseEditBuffer(service: object): ReleaseEditBuffer {
  let buffer = BUFFERS.get(service);
  if (!buffer) {
    buffer = new ReleaseEditBuffer();
    BUFFERS.set(service, buffer);
  }
  return buffer;
}
/** One local edit writer; failed writes remain visible and must settle before physical actions. */
export class ReleaseEditBuffer {
  readonly #edits = new Map<string, PendingQuantity>();
  #tail: Promise<void> = Promise.resolve();
  #revision = 0;
  get revision(): number {
    return this.#revision;
  }
  hasPending(eventId: string | undefined): boolean {
    return eventId !== undefined && this.#edits.has(eventId);
  }
  edit(eventId: string, quantity: string, write: () => Promise<void>): void {
    this.#edits.set(eventId, { quantity, write });
    this.#revision++;
  }
  merge(state: ReleaseState): ReleaseState {
    if (!state.draft || state.event) return state;
    const pending = this.#edits.get(state.draft.eventId);
    return pending ? { ...state, draft: { ...state.draft, quantity: pending.quantity } } : state;
  }
  persist(eventId: string): Promise<void> {
    const next = this.#tail.catch(() => undefined).then(() => this.#flush(eventId));
    this.#tail = next;
    return next;
  }
  async #flush(eventId: string): Promise<void> {
    while (this.#edits.has(eventId)) {
      const pending = this.#edits.get(eventId);
      if (!pending) return;
      await pending.write();
      if (this.#edits.get(eventId) === pending) {
        this.#edits.delete(eventId);
        this.#revision++;
      }
    }
  }
}
