/** Fake event used only by the benchmark. Mirrors the PoC table in issue #1 section 4. */
export type EventStatus = 'pending' | 'sent';

export type FakeEvent = {
  /** Client-generated UUID (idempotency key). */
  id: string;
  type: string;
  /** JSON text. */
  payload: string;
  /** Epoch milliseconds on the device clock. */
  device_time: number;
  status: EventStatus;
};

/** Same operations for both candidate libraries, so the timings are comparable. */
export interface EventStore {
  readonly name: string;
  open(): Promise<void>;
  /** Extra info worth showing next to the timings (for example the dispatcher mode). */
  describe(): string;
  count(): Promise<number>;
  countPending(): Promise<number>;
  insertMany(events: FakeEvent[]): Promise<void>;
  insertOne(event: FakeEvent): Promise<void>;
  /** Oldest pending events first (the next sync batch). */
  readPending(limit: number): Promise<FakeEvent[]>;
  markSent(ids: string[]): Promise<void>;
  clear(): Promise<void>;
}
