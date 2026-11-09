import type { ReceiptDraft, ReceiptState } from "./receipt-types.ts";

interface PendingEdit {
  readonly eventId: string;
  readonly write: () => Promise<unknown>;
  readonly apply: (draft: ReceiptDraft) => ReceiptDraft;
}
const SERVICE_BUFFERS = new WeakMap<object, ReceiptEditBuffer>();
/** Remounting P8 cannot discard input whose local storage write is still failing. */
export function receiptEditBuffer(service: object): ReceiptEditBuffer {
  let buffer = SERVICE_BUFFERS.get(service);
  if (buffer === undefined) {
    buffer = new ReceiptEditBuffer();
    SERVICE_BUFFERS.set(service, buffer);
  }
  return buffer;
}

/** Failed editor writes remain visible and retry before any capture or navigation action. */
export class ReceiptEditBuffer {
  readonly #edits = new Map<string, PendingEdit>();
  #tail: Promise<void> = Promise.resolve();
  #revision = 0;
  get revision(): number {
    return this.#revision;
  }
  get hasPending(): boolean {
    return this.#edits.size > 0;
  }
  edit(key: string, edit: PendingEdit): void {
    this.#edits.set(key, edit);
    this.#revision++;
  }
  merge(state: ReceiptState): ReceiptState {
    if (state.draft === null || state.event !== null) return state;
    let draft = state.draft;
    for (const edit of this.#edits.values()) {
      if (edit.eventId === draft.eventId) draft = edit.apply(draft);
    }
    return { ...state, draft };
  }
  persist(): Promise<void> {
    const next = this.#tail.catch(() => undefined).then(() => this.#flush());
    this.#tail = next;
    return next;
  }
  async #flush(): Promise<void> {
    for (const [key, edit] of this.#edits) {
      await edit.write();
      if (this.#edits.get(key) === edit) {
        this.#edits.delete(key);
        this.#revision++;
      }
    }
  }
}

/** Recovery can repair unavailable sources without discarding or falsely saving buffered input. */
export async function runReceiptOperation(input: {
  readonly buffer: ReceiptEditBuffer;
  readonly operation: () => Promise<unknown>;
  readonly shouldPersist: boolean;
}): Promise<void> {
  if (input.shouldPersist) await input.buffer.persist();
  await input.operation();
}
