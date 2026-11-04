import { open } from '@op-engineering/op-sqlite';
import type { DB, Scalar } from '@op-engineering/op-sqlite';

import type { EventStatus, EventStore, FakeEvent } from './types';

const DB_NAME = 'spike_opsqlite.db';

/**
 * Same durability settings requested from both stores (WatermelonDB's JSI code asks for WAL + FULL, see
 * node_modules/@nozbe/watermelondb/native/shared/Database.cpp). The values really in effect are read back
 * and logged by describe(), so the comparison is honest even if a library ignores the request.
 */
const PRAGMAS = ['PRAGMA journal_mode = WAL', 'PRAGMA synchronous = FULL'];

function firstValue(rows: Record<string, unknown>[]): string {
  return String(Object.values(rows[0] ?? {})[0]);
}

const INSERT_SQL = 'INSERT OR REPLACE INTO event (id, type, payload, device_time, status) VALUES (?, ?, ?, ?, ?)';

function toParams(event: FakeEvent): Scalar[] {
  return [event.id, event.type, event.payload, event.device_time, event.status];
}

function readString(value: Scalar | undefined): string {
  if (typeof value !== 'string') throw new Error(`Expected string column, got ${typeof value}`);
  return value;
}

function readNumber(value: Scalar | undefined): number {
  if (typeof value !== 'number') throw new Error(`Expected number column, got ${typeof value}`);
  return value;
}

function readStatus(value: Scalar | undefined): EventStatus {
  const text = readString(value);
  if (text !== 'pending' && text !== 'sent') throw new Error(`Unknown status in database: ${text}`);
  return text;
}

export class OpSqliteStore implements EventStore {
  readonly name = 'op-sqlite';
  private db: DB | null = null;
  private settings = 'not read';

  async open(): Promise<void> {
    const db = open({ name: DB_NAME });
    await db.execute(
      'CREATE TABLE IF NOT EXISTS event (id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, device_time INTEGER NOT NULL, status TEXT NOT NULL)'
    );
    // The first spike build created event_status_time (status, device_time). Phones that ran it still have it,
    // which would favor op-sqlite, so it is dropped.
    await db.execute('DROP INDEX IF EXISTS event_status_time');
    // Same index as WatermelonDB's schema (isIndexed on status only), so neither store has an edge.
    await db.execute('CREATE INDEX IF NOT EXISTS event_status ON event (status)');
    for (const pragma of PRAGMAS) await db.execute(pragma);
    const journal = await db.execute('PRAGMA journal_mode');
    const synchronous = await db.execute('PRAGMA synchronous');
    this.settings =
      `journal_mode=${firstValue(journal.rows)}, synchronous=${firstValue(synchronous.rows)} ` +
      '(0=OFF 1=NORMAL 2=FULL 3=EXTRA)';
    const indexes = await db.execute('PRAGMA index_list(event)');
    this.settings += `, indexes=[${indexes.rows.map((row) => String(row.name)).join(', ')}]`;
    this.db = db;
  }

  describe(): string {
    return `op-sqlite, async execute, SQLite file in app storage, ${this.settings}`;
  }

  private get handle(): DB {
    if (this.db === null) throw new Error('op-sqlite store is not open');
    return this.db;
  }

  async count(): Promise<number> {
    const result = await this.handle.execute('SELECT COUNT(*) AS total FROM event');
    return readNumber(result.rows[0]?.total);
  }

  async countPending(): Promise<number> {
    const result = await this.handle.execute("SELECT COUNT(*) AS total FROM event WHERE status = 'pending'");
    return readNumber(result.rows[0]?.total);
  }

  async insertMany(events: FakeEvent[]): Promise<void> {
    // One statement with many parameter sets, executed in a single native transaction.
    await this.handle.executeBatch([[INSERT_SQL, events.map(toParams)]]);
  }

  async insertOne(event: FakeEvent): Promise<void> {
    await this.handle.execute(INSERT_SQL, toParams(event));
  }

  async readPending(limit: number): Promise<FakeEvent[]> {
    const result = await this.handle.execute(
      "SELECT id, type, payload, device_time, status FROM event WHERE status = 'pending' ORDER BY device_time ASC LIMIT ?",
      [limit]
    );
    return result.rows.map((row) => ({
      id: readString(row.id),
      type: readString(row.type),
      payload: readString(row.payload),
      device_time: readNumber(row.device_time),
      status: readStatus(row.status),
    }));
  }

  async markSent(ids: string[]): Promise<void> {
    await this.handle.executeBatch([["UPDATE event SET status = 'sent' WHERE id = ?", ids.map((id) => [id])]]);
  }

  async clear(): Promise<void> {
    await this.handle.execute('DELETE FROM event');
  }
}
