import type { SqlExecutor } from "../../db/sql.ts";
import { parseQr } from "../ovitrap-check/domain.ts";
import { OvitrapStore } from "../ovitrap-check/store.ts";
import type { LifecycleSourceTurn } from "../ovitrap-lifecycle/types.ts";
import type { ScannerError, ScannerInput } from "./domain.ts";
import { readBagContext } from "./resource-source.ts";

/** Same human bag code the backend accepts (`bag_code` in `ovitrap.check`). */
const BAG_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;

/** What to hand to `OvitrapService.enterBag`, or why the bag cannot be bound. */
export type BagEntry = { readonly value: string } | { readonly error: ScannerError };

/**
 * Bags are not registered before a check: the server creates the bag from the human code the
 * phone sends. So a typed code is bound as is, and a scanned QR only when the phone knows its code.
 */
export async function resolveBagEntry(
  db: SqlExecutor,
  turn: LifecycleSourceTurn,
  input: ScannerInput,
): Promise<BagEntry> {
  const context = await readBagContext(db, turn);
  if (!context) return { error: "unavailable" };
  const scannedId = input.isManual ? null : parseQr(input.value, "bag")?.id;
  const code = input.isManual
    ? input.value.trim()
    : context.bags.find((bag) => bag.id === scannedId)?.code;
  if (!code) return { error: "bagCode" };
  if (!BAG_CODE.test(code)) return { error: "invalid" };
  if (await turn.write(() => new OvitrapStore(db).isBagReserved(code))) return { error: "bagUsed" };
  return { value: input.isManual ? code : input.value };
}
