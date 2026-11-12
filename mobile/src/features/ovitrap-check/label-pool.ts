import { KV_KEYS, KvStore } from "../../db/kv-store.ts";
import type { SqlExecutor } from "../../db/sql.ts";

/** One printed label that is not on a trap yet: its QR identity and the short code printed large on it. */
export interface PoolLabel {
  readonly id: string;
  readonly code: string;
}

const SHORT_CODE = /^OVT-?0*([0-9]{1,9})$/i;
const CODE_PADDING = 4;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The canonical short code of what a person typed: any case, with or without the dash, with or
 * without leading zeros (`ovt1`, `OVT-01`, `OVT-0001` are the same label). Digits alone are not
 * a code. Anything else is not a short code (it may still be a UUID).
 */
export function normalizeLabelCode(value: string): string | null {
  const match = SHORT_CODE.exec(value.trim());
  if (!match?.[1]) return null;
  const number = Number(match[1]);
  return number > 0 ? `OVT-${String(number).padStart(CODE_PADDING, "0")}` : null;
}

/** The label of a typed short code; null when the code is unknown to this phone. */
export function findPoolLabel(pool: readonly PoolLabel[], value: string): PoolLabel | null {
  const code = normalizeLabelCode(value);
  return code === null ? null : (pool.find((label) => label.code === code) ?? null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The pool as the server sends it; a malformed row fails the whole read, never half a pool. */
export function readLabelPool(value: unknown): readonly PoolLabel[] {
  if (!isRecord(value) || !Array.isArray(value.labels)) throw new Error("Malformed label pool.");
  return value.labels.map((row: unknown) => {
    if (
      !isRecord(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.code !== "string" ||
      normalizeLabelCode(row.code) !== row.code
    )
      throw new Error("Malformed label pool.");
    return { id: row.id.toLowerCase(), code: row.code };
  });
}

/** The pool kept on the phone so a typed code resolves without a network. */
export class LabelPoolStore {
  readonly #kv: KvStore;
  constructor(db: SqlExecutor) {
    this.#kv = new KvStore(db);
  }
  async save(pool: readonly PoolLabel[]): Promise<void> {
    await this.#kv.set(KV_KEYS.ovitrapLabels, JSON.stringify(pool));
  }
  async read(): Promise<readonly PoolLabel[]> {
    const raw = await this.#kv.get(KV_KEYS.ovitrapLabels);
    if (raw === null) return [];
    try {
      const stored: unknown = JSON.parse(raw);
      return readLabelPool({ labels: stored });
    } catch {
      return [];
    }
  }
}
