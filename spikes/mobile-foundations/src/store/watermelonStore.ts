import { Database, Model, Q, appSchema, tableSchema } from '@nozbe/watermelondb';
import type { RawRecord } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import type { EventStatus, EventStore, FakeEvent } from './types';

const TABLE = 'event';

/**
 * Model without decorators on purpose: the PoC avoids the Babel decorators plugin. Columns are read
 * through the raw record. A real app would use @field decorators (or this same pattern).
 */
class EventModel extends Model {
  static table = TABLE;
}

const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: TABLE,
      columns: [
        { name: 'type', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'device_time', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
      ],
    }),
  ],
});

function readStatus(value: unknown): EventStatus {
  if (value !== 'pending' && value !== 'sent') throw new Error(`Unknown status in database: ${String(value)}`);
  return value;
}

function toModelFields(event: FakeEvent): { id: string; type: string; payload: string; device_time: number; status: string } {
  return { id: event.id, type: event.type, payload: event.payload, device_time: event.device_time, status: event.status };
}

function fromRaw(raw: RawRecord): FakeEvent {
  const record = raw as unknown as Record<string, unknown>;
  const type = record.type;
  const payload = record.payload;
  const deviceTime = record.device_time;
  if (typeof type !== 'string' || typeof payload !== 'string' || typeof deviceTime !== 'number') {
    throw new Error('Unexpected column types in WatermelonDB record');
  }
  return { id: raw.id, type, payload, device_time: deviceTime, status: readStatus(record.status) };
}

export class WatermelonStore implements EventStore {
  readonly name = 'WatermelonDB';
  private database: Database | null = null;
  private adapter: SQLiteAdapter | null = null;
  private settings = 'not read';

  async open(): Promise<void> {
    // onSetUpError fires asynchronously and initializingPromise does not report it: turn it into a
    // rejection so the screen log shows it and open() fails instead of hanging or looking fine.
    let failSetup: (error: Error) => void = () => undefined;
    const setupFailed = new Promise<never>((_resolve, reject) => {
      failSetup = reject;
    });
    const adapter = new SQLiteAdapter({
      dbName: 'spike_watermelon',
      schema,
      // Ask for JSI (synchronous native calls). If the native JSI package is not linked the
      // adapter falls back to the asynchronous bridge and logs a warning. describe() shows which
      // one really ran.
      jsi: true,
      onSetUpError: (error: Error) => {
        console.error('WatermelonDB setup failed', error);
        failSetup(error);
      },
    });
    this.adapter = adapter;
    this.database = new Database({ adapter, modelClasses: [EventModel] });
    await Promise.race([adapter.initializingPromise, setupFailed]);
    // Setup succeeded: a later onSetUpError must not become an unhandled rejection.
    setupFailed.catch(() => undefined);
    await this.applyAndReadPragmas();
  }

  /**
   * Best effort: asks for the same WAL + FULL as op-sqlite and reads back what is in effect.
   * [ASSUMPTION] Q.unsafeSqlQuery accepts a PRAGMA on the Android async bridge; if it does not, the
   * failure is shown in describe() instead of aborting the benchmark.
   */
  private async applyAndReadPragmas(): Promise<void> {
    const read = async (pragma: string): Promise<string> => {
      const rows = await this.collection.query(Q.unsafeSqlQuery(pragma)).unsafeFetchRaw();
      return String(Object.values((rows[0] ?? {}) as Record<string, unknown>)[0]);
    };
    try {
      await read('PRAGMA journal_mode = WAL');
      await read('PRAGMA synchronous = FULL');
      const journal = await read('PRAGMA journal_mode');
      const synchronous = await read('PRAGMA synchronous');
      this.settings = `journal_mode=${journal}, synchronous=${synchronous} (0=OFF 1=NORMAL 2=FULL 3=EXTRA)`;
    } catch (error) {
      this.settings = `could not set or read PRAGMAs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  describe(): string {
    const mode = this.adapter?._dispatcherType ?? 'unknown';
    return `WatermelonDB over SQLite, dispatcher: ${mode}, ${this.settings}`;
  }

  private get db(): Database {
    if (this.database === null) throw new Error('WatermelonDB store is not open');
    return this.database;
  }

  private get collection() {
    return this.db.get<EventModel>(TABLE);
  }

  async count(): Promise<number> {
    return this.collection.query().fetchCount();
  }

  async countPending(): Promise<number> {
    return this.collection.query(Q.where('status', 'pending')).fetchCount();
  }

  async insertMany(events: FakeEvent[]): Promise<void> {
    const records = events.map((event) => this.collection.prepareCreateFromDirtyRaw(toModelFields(event)));
    await this.db.write(async () => {
      await this.db.batch(records);
    });
  }

  async insertOne(event: FakeEvent): Promise<void> {
    await this.db.write(async () => {
      await this.collection.create((record) => {
        record._raw.id = event.id;
        record._setRaw('type', event.type);
        record._setRaw('payload', event.payload);
        record._setRaw('device_time', event.device_time);
        record._setRaw('status', event.status);
      });
    });
  }

  async readPending(limit: number): Promise<FakeEvent[]> {
    const records = await this.collection
      .query(Q.where('status', 'pending'), Q.sortBy('device_time', Q.asc), Q.take(limit))
      .fetch();
    return records.map((record) => fromRaw(record._raw));
  }

  async markSent(ids: string[]): Promise<void> {
    const records = await this.collection.query(Q.where('id', Q.oneOf(ids))).fetch();
    const updates = records.map((record) =>
      record.prepareUpdate((draft) => {
        draft._setRaw('status', 'sent');
      })
    );
    await this.db.write(async () => {
      await this.db.batch(updates);
    });
  }

  async clear(): Promise<void> {
    await this.db.write(async () => {
      await this.db.unsafeResetDatabase();
    });
  }
}
