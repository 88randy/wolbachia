import type { SecretStorage } from "../auth/secret-storage.ts";
import type { SqlExecutor } from "./sql.ts";

export const DATABASE_NAME = "wolbachia_field_encrypted_v1.db";
const KEY_ITEM = "database_key_v1";
const KEY_BYTES = 32;

interface EncryptedDatabaseDeps {
  readonly secrets: SecretStorage;
  readonly randomBytes: (length: number) => Uint8Array;
  readonly open: (options: { name: string; encryptionKey: string }) => SqlExecutor;
}

/** Validate encryption and actually read before persisting a newly generated key. Never delete. */
export async function openEncryptedDatabase(deps: EncryptedDatabaseDeps): Promise<SqlExecutor> {
  const savedKey = await deps.secrets.get(KEY_ITEM);
  const encryptionKey = savedKey ?? toHex(deps.randomBytes(KEY_BYTES));
  const db = deps.open({ name: DATABASE_NAME, encryptionKey });
  const [cipher] = await db.query("PRAGMA cipher_version");
  if (cipher === undefined || !Object.values(cipher).some(isNonemptyText)) {
    throw new Error("SQLCipher is required; refusing to open plaintext storage.");
  }
  // A cipher version alone does not validate the key of an existing encrypted file.
  await db.query("SELECT count(*) FROM sqlite_master");
  if (savedKey === null) await deps.secrets.set(KEY_ITEM, encryptionKey);
  return db;
}

function isNonemptyText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
