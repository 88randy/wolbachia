import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { tableErrorKey } from "../data-table/table-error";
import { blockerKeys } from "./inventory-fields";
export interface InventoryFailure {
  key: MessageKey;
  reasons: MessageKey[];
  conflict: boolean;
  uncertain: boolean;
  retryAt: number;
}
export const UNCERTAIN_WRITE: InventoryFailure = {
  key: "inventory.state.uncertain",
  reasons: [],
  conflict: false,
  uncertain: true,
  retryAt: 0,
};
export class InventoryRateLimit extends ApiError {
  readonly retryAt: number;
  constructor(response: Response, error: unknown) {
    super(response.status, isErrorEnvelope(error) ? error : undefined);
    const header = response.headers.get("Retry-After") ?? "";
    const parsed = /^\d+$/.test(header) ? Date.now() + Number(header) * 1000 : Date.parse(header);
    this.retryAt = Number.isFinite(parsed) ? parsed : 0;
  }
}
export function inventoryFailure(error: unknown): InventoryFailure {
  const conflict = error instanceof ApiError && error.status === 409;
  const reasons =
    error instanceof ApiError
      ? (error.envelope?.blocked_by?.map((item) =>
          item.reason === "inventory_revision_conflict"
            ? "inventory.state.conflict"
            : (blockerKeys[item.reason] ?? "inventory.blocker.unknown"),
        ) ?? [])
      : [];
  return {
    key: conflict ? "inventory.state.conflict" : tableErrorKey(error),
    reasons: reasons.filter((reason) => reason !== "inventory.state.conflict"),
    conflict,
    uncertain: !(error instanceof ApiError) || error.status >= 500,
    retryAt: error instanceof InventoryRateLimit ? error.retryAt : 0,
  };
}
