import type { MessageKey } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { todayIn } from "../../../format/time-zone";

export interface DraftLine {
  /** Stable React key of the row. */
  key: string;
  /** Lot id, empty until chosen. */
  lotId: string;
  quantity: string;
}
export interface TransferDraft {
  originId: string;
  destinationId: string;
  lines: DraftLine[];
}
/** One lot that can leave the chosen origin: what is there now, and its unit version. */
export interface StockChoice {
  lotId: string;
  lotCode: string;
  supplyLabel: string;
  unit: string;
  available: string;
  unitVersionId: string;
}

const MICRO = 6;
/** Exact decimal to integer micro-units, so stock is never compared as a float. */
export function toMicro(value: string): bigint | undefined {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) return undefined;
  const fraction = (match[2] ?? "").padEnd(MICRO, "0");
  return BigInt(match[1] ?? "0") * 10n ** BigInt(MICRO) + BigInt(fraction);
}

export function newLine(): DraftLine {
  return { key: crypto.randomUUID(), lotId: "", quantity: "" };
}

/** A readable, unique folio: T-YYMMDD-XXXX. The person never types it. */
export function newFolio(timeZone: string, now = new Date()): string {
  const day = todayIn(timeZone, now).slice(2).replaceAll("-", "");
  return `T-${day}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

function lineBlocker(line: DraftLine, stock: ReadonlyMap<string, StockChoice>) {
  const choice = stock.get(line.lotId);
  const quantity = toMicro(line.quantity);
  if (!choice || quantity === undefined || quantity <= 0n)
    return "transfers.new.blocker.items" as const;
  const available = toMicro(choice.available);
  return available !== undefined && quantity > available
    ? ("transfers.new.blocker.tooMuch" as const)
    : undefined;
}

/** What still stops the shipment from being prepared, in plain words. */
export function draftBlockers(
  draft: TransferDraft,
  stock: ReadonlyMap<string, StockChoice>,
): MessageKey[] {
  const keys: MessageKey[] = [];
  if (!draft.originId) keys.push("transfers.new.blocker.origin");
  if (!draft.destinationId) keys.push("transfers.new.blocker.destination");
  if (draft.originId && draft.originId === draft.destinationId)
    keys.push("transfers.new.blocker.same");
  const found = draft.lines.map((line) => lineBlocker(line, stock));
  const lotIds = draft.lines.map((line) => line.lotId).filter(Boolean);
  if (found.some(Boolean) || draft.lines.length === 0)
    keys.push(found.find(Boolean) ?? "transfers.new.blocker.items");
  if (new Set(lotIds).size !== lotIds.length) keys.push("transfers.new.blocker.repeated");
  return [...new Set(keys)];
}

export function prepareBody(
  folio: string,
  draft: TransferDraft,
  stock: ReadonlyMap<string, StockChoice>,
): Schemas["PrepareTransferRequest"] {
  return {
    code: folio,
    origin_id: draft.originId,
    destination_id: draft.destinationId,
    lines: draft.lines.map((line) => ({
      lot_id: line.lotId,
      piece_id: null,
      unit_version_id: stock.get(line.lotId)?.unitVersionId ?? "",
      quantity: line.quantity.trim(),
    })),
  };
}
