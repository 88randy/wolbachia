import type { MessageKey } from "@wolbachia/i18n";
import type { FilterDefinition, TableQueryConfig, TableState } from "../data-table/table-types";
import type { InventoryKind } from "./inventory-links";
import { blockerKeys } from "./inventory-fields";
export const INVENTORY_PAGE_SIZE = 25;
const text = (key: string, labelKey: MessageKey): FilterDefinition => ({
  key,
  labelKey,
  kind: "text",
  maxLength: 200,
});
const select = (
  key: string,
  labelKey: MessageKey,
  values: readonly (readonly [string, MessageKey])[],
): FilterDefinition => ({
  key,
  labelKey,
  kind: "select",
  options: values.map(([value, option]) => ({ value, labelKey: option })),
});
const yesNo = [
  ["true", "inventory.option.yes"],
  ["false", "inventory.option.no"],
] as const;
const base = {
  paging: "page",
  pageSize: INVENTORY_PAGE_SIZE,
  defaultOrdering: "code",
  sortableIds: ["code", "created_at"],
  supportsVoided: false,
} as const;
export const INVENTORY_TABLES: Record<InventoryKind, TableQueryConfig> = {
  supplies: {
    ...base,
    filters: [
      text("search", "inventory.field.search"),
      select("is_active", "inventory.field.status", yesNo),
      select("is_biological", "inventory.field.isBiological", yesNo),
      select("identity_kind", "inventory.field.identityKind", [
        ["piece", "inventory.option.piece"],
        ["lot", "inventory.option.lot"],
      ]),
    ],
  },
  lots: {
    ...base,
    sortableIds: ["code", "created_at", "expiry"],
    filters: [
      text("search", "inventory.field.search"),
      text("supply", "inventory.field.supply"),
      text("location", "inventory.field.location"),
      text("center", "inventory.field.center"),
      select("status", "inventory.field.status", [
        ["draft", "inventory.status.draft"],
        ["blocked", "inventory.status.blocked"],
        ["available", "inventory.status.available"],
      ]),
      select("blocked_by", "inventory.field.blocker", Object.entries(blockerKeys)),
      text("expiry_from_date", "inventory.field.expiryFrom"),
      text("expiry_before_date", "inventory.field.expiryBefore"),
      text("expiry_from", "inventory.field.expiryFromInstant"),
      text("expiry_before", "inventory.field.expiryBeforeInstant"),
    ],
  },
  locations: {
    ...base,
    filters: [
      text("search", "inventory.field.search"),
      text("center", "inventory.field.center"),
      select("kind", "inventory.field.kind", [
        ["biofactory", "inventory.option.biofactory"],
        ["warehouse", "inventory.option.warehouse"],
        ["center", "inventory.option.center"],
      ]),
      select("is_insecticide_free", "inventory.field.isInsecticideFree", yesNo),
    ],
  },
};
export const STOCK_TABLE: TableQueryConfig = {
  ...base,
  defaultOrdering: "lot__code",
  sortableIds: ["lot__code", "piece_id"],
  filters: [text("lot", "inventory.field.code"), text("supply", "inventory.field.supply")],
};
export const MOVEMENT_TABLE: TableQueryConfig = {
  ...base,
  defaultOrdering: "-created_at",
  sortableIds: ["created_at", "lot_code", "quantity"],
  filters: [
    ...STOCK_TABLE.filters,
    text("operation", "inventory.field.operation"),
    text("piece", "inventory.field.piece"),
    text("unit", "inventory.field.unit"),
    text("created_at_from", "inventory.field.movementFrom"),
    text("created_at_before", "inventory.field.movementBefore"),
  ],
};
/** Only allowlisted server parameters leave the screen; view is a local URL concern. */
export function inventoryParams(state: TableState) {
  const ordering =
    state.isSortExplicit && state.sort
      ? `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`
      : undefined;
  const filters = Object.fromEntries(
    Object.entries(state.filters).filter(([key]) => key !== "view"),
  );
  return {
    ...filters,
    page: state.page,
    page_size: INVENTORY_PAGE_SIZE,
    ...(ordering ? { ordering } : {}),
  };
}
