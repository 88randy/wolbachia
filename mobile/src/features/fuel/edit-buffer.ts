import type { FuelDraft, FuelState } from "./types.ts";

interface PendingEdit {
  readonly eventId: string;
  readonly write: () => Promise<unknown>;
  readonly apply: (draft: FuelDraft) => FuelDraft;
}
const SERVICE_BUFFERS = new WeakMap<object, FuelEditBuffer>();
/** A remount retains input whose local storage write still needs retry. */
export function fuelEditBuffer(service: object): FuelEditBuffer {
  let buffer = SERVICE_BUFFERS.get(service);
  if (buffer === undefined) {
    buffer = new FuelEditBuffer();
    SERVICE_BUFFERS.set(service, buffer);
  }
  return buffer;
}

/** Failed writes stay visible and must finish before camera acquisition or Save. */
export class FuelEditBuffer {
  readonly #edits = new Map<string, PendingEdit>();
  #tail: Promise<void> = Promise.resolve();
  #revision = 0;
  get revision(): number {
    return this.#revision;
  }
  get hasPending(): boolean {
    return this.#edits.size > 0;
  }
  hasPendingFor(eventId: string | undefined): boolean {
    return [...this.#edits.values()].some((edit) => edit.eventId === eventId);
  }
  edit(key: string, edit: PendingEdit): void {
    this.#edits.set(`${edit.eventId}:${key}`, edit);
    this.#revision++;
  }
  merge(state: FuelState): FuelState {
    if (state.draft === null || state.event !== null) return state;
    let draft = state.draft;
    for (const edit of this.#edits.values()) {
      if (edit.eventId === draft.eventId) draft = edit.apply(draft);
    }
    return { ...state, draft };
  }
  persist(eventId?: string): Promise<void> {
    const next = this.#tail.catch(() => undefined).then(() => this.#flush(eventId));
    this.#tail = next;
    return next;
  }
  async #flush(eventId?: string): Promise<void> {
    while (this.#edits.size > 0) {
      const pending = [...this.#edits].find(
        ([, edit]) => eventId === undefined || edit.eventId === eventId,
      );
      if (pending === undefined) return;
      const [key, edit] = pending;
      await edit.write();
      if (this.#edits.get(key) === edit) {
        this.#edits.delete(key);
        this.#revision++;
      }
    }
  }
}

/** Read-only recovery may inspect retained work even while an edit cannot be saved. */
export async function runFuelOperation(input: {
  readonly buffer: FuelEditBuffer;
  readonly operation: () => Promise<unknown>;
  readonly shouldPersist: boolean;
  readonly eventId?: string;
}): Promise<void> {
  if (input.shouldPersist) await input.buffer.persist(input.eventId);
  await input.operation();
}
