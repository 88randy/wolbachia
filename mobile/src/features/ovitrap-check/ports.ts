import { parseQr } from "./domain.ts";
import type { FieldEventEnvelope } from "../../outbox/outbox-event.ts";
import type { Draft } from "./types.ts";
export class PendingDraftError extends Error {
  constructor() {
    super("A different capture draft is pending.");
    this.name = "PendingDraftError";
  }
}
/** Reject a target switch without destroying or disguising the pending draft. */
export function assertSameTarget(current: Draft, mode: Draft["mode"], id?: string): void {
  if (current.mode !== mode || (mode === "check" && current.ovitrapId !== id))
    throw new PendingDraftError();
}
/** Invalid coordinates never look compliant; missing/poor accuracy remains explicit for server review. */
export function normalizeGps(gps: FieldEventEnvelope["gps"]): FieldEventEnvelope["gps"] {
  if (!gps) return null;
  if (
    !Number.isFinite(gps.lat) ||
    !Number.isFinite(gps.lng) ||
    Math.abs(gps.lat) > 90 ||
    Math.abs(gps.lng) > 180
  )
    return null;
  const accuracy = gps.accuracy_m;
  return {
    lat: gps.lat,
    lng: gps.lng,
    accuracy_m: typeof accuracy === "number" && Number.isFinite(accuracy) ? accuracy : null,
  };
}

export function bagIdentity(
  value: string,
  draft: Draft,
): Pick<Draft, "bagCode" | "bagUuid" | "bagQrHistory"> {
  const parsed = parseQr(value.trim(), "bag");
  if (parsed)
    return {
      bagCode: draft.assignment?.bags.find((bag) => bag.id === parsed.id)?.code ?? "",
      bagUuid: parsed.id,
      bagQrHistory: [...new Set([...draft.bagQrHistory, parsed.id])],
    };
  const code = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/.test(code)) throw new Error("Invalid manual bag code.");
  return { bagCode: code, bagUuid: null, bagQrHistory: draft.bagQrHistory };
}

export class CatalogChangedError extends Error {
  constructor() {
    super("Captured choice is absent from the new snapshot.");
    this.name = "CatalogChangedError";
  }
}
