/**
 * The small SQL surface the app needs. The app uses op-sqlite (`open-database.ts`); tests use
 * Node's built-in SQLite behind the same interface, so the outbox SQL is exercised without a phone.
 */

export type SqlValue = string | number | null;

export type SqlRow = Readonly<Record<string, unknown>>;

export interface SqlStatement {
  readonly sql: string;
  readonly params?: readonly SqlValue[];
}

export interface SqlExecutor {
  /** Runs one statement and returns its rows (empty for writes). */
  query(sql: string, params?: readonly SqlValue[]): Promise<readonly SqlRow[]>;
  /** Runs statements in order in ONE transaction: all of them apply, or none. */
  runAtomically(statements: readonly SqlStatement[]): Promise<void>;
}

/** Reads a TEXT column that must be there. */
export function readText(row: SqlRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") throw new Error(`Column ${column} is not text.`);
  return value;
}

/** Reads a TEXT column that may be NULL. */
export function readOptionalText(row: SqlRow, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  return readText(row, column);
}

/** Reads an INTEGER column. */
export function readInteger(row: SqlRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number") throw new Error(`Column ${column} is not a number.`);
  return value;
}
