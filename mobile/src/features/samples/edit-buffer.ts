import type { SamplePatch, SampleState } from "./types.ts";

interface PendingEdit {
  readonly patch: SamplePatch;
  readonly write: (patch: SamplePatch) => Promise<void>;
}
const BUFFERS = new WeakMap<object, SampleEditBuffer>();
/** A failed local raw edit survives a screen remount for this same owner-fenced service. */
export function sampleEditBuffer(service: object): SampleEditBuffer {
  let buffer = BUFFERS.get(service);
  if (!buffer) {
    buffer = new SampleEditBuffer();
    BUFFERS.set(service, buffer);
  }
  return buffer;
}
/** One local writer coalesces raw fields without losing a field to a later keystroke. */
export class SampleEditBuffer {
  readonly #edits = new Map<string, PendingEdit>();
  #tail: Promise<void> = Promise.resolve();
  #revision = 0;
  get revision(): number {
    return this.#revision;
  }
  hasPending(sampleId: string | undefined): boolean {
    return sampleId !== undefined && this.#edits.has(sampleId);
  }
  edit(sampleId: string, patch: SamplePatch, write: PendingEdit["write"]): void {
    this.#edits.set(sampleId, { patch: { ...this.#edits.get(sampleId)?.patch, ...patch }, write });
    this.#revision++;
  }
  merge(state: SampleState): SampleState {
    if (!state.draft || state.event) return state;
    const pending = this.#edits.get(state.draft.sampleId);
    return pending ? { ...state, draft: { ...state.draft, ...pending.patch } } : state;
  }
  persist(sampleId: string): Promise<void> {
    const next = this.#tail.catch(() => undefined).then(() => this.#flush(sampleId));
    this.#tail = next;
    return next;
  }
  async #flush(sampleId: string): Promise<void> {
    while (this.#edits.has(sampleId)) {
      const pending = this.#edits.get(sampleId);
      if (!pending) return;
      await pending.write(pending.patch);
      if (this.#edits.get(sampleId) === pending) {
        this.#edits.delete(sampleId);
        this.#revision++;
      }
    }
  }
}
