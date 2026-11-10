import { CENTER_LOOKUP, LOCATION_LOOKUP, SUPPLY_LOOKUP } from "../lookups/lookup-sources";
import type { LookupSource } from "../lookups/lookup-sources";
import type { MessageKey } from "@wolbachia/i18n";
import type {
  FilterDefinition,
  SelectFilter,
  TableQueryConfig,
  TableState,
} from "../data-table/table-types";
import type { InventoryKind } from "./inventory-links";
import { blockerKeys } from "./inventory-fields";
export const INVENTORY_PAGE_SIZE = 25;
const text = (key: string, labelKey: MessageKey): FilterDefinition => ({
  key,
  labelKey,
  kind: "text",
  maxLength: 200,
});
const dateEnd = (
  key: string,
  labelKey: MessageKey,
  end: { input: "date-from" | "date-to"; dateFormat?: "date" | "datetime" },
): FilterDefinition => ({
  key,
  labelKey,
  kind: "text",
  maxLength: 40,
  input: end.input,
  dateFormat: end.dateFormat ?? "datetime",
});
const hidden = (key: string, labelKey: MessageKey): FilterDefinition => ({
  key,
  labelKey,
  kind: "text",
  maxLength: 200,
  input: "hidden",
});
const pick = (key: string, labelKey: MessageKey, lookup: LookupSource): FilterDefinition => ({
  key,
  labelKey,
  kind: "text",
  maxLength: 36,
  input: "lookup",
  lookup,
});
const select = (
  key: string,
  labelKey: MessageKey,
  values: readonly (readonly [string, MessageKey])[],
): SelectFilter => ({
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
  sortOptions: [
    { value: "code", labelKey: "inventory.field.code" },
    { value: "created_at", labelKey: "inventory.field.createdAt" },
  ],
} as const;
export const INVENTORY_TABLES: Record<InventoryKind, TableQueryConfig> = {
  supplies: {
    ...base,
    filters: [
      text("search", "inventory.field.search"),
      {
        ...select("is_active", "inventory.field.status", [
          ["true", "inventory.status.active"],
          ["false", "inventory.status.inactive"],
        ]),
        presentation: "segmented",
      },
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
    sortOptions: [...base.sortOptions, { value: "expiry", labelKey: "inventory.field.expiry" }],
    filters: [
      text("search", "inventory.field.search"),
      pick("supply", "inventory.field.supply", SUPPLY_LOOKUP),
      pick("location", "inventory.field.location", LOCATION_LOOKUP),
      pick("center", "inventory.field.center", CENTER_LOOKUP),
      select("status", "inventory.field.status", [
        ["draft", "inventory.status.draft"],
        ["blocked", "inventory.status.blocked"],
        ["available", "inventory.status.available"],
      ]),
      select("blocked_by", "inventory.field.blocker", Object.entries(blockerKeys)),
      dateEnd("expiry_from_date", "inventory.field.expiryFrom", {
        input: "date-from",
        dateFormat: "date",
      }),
      dateEnd("expiry_before_date", "inventory.field.expiryBefore", {
        input: "date-to",
        dateFormat: "date",
      }),
      hidden("expiry_from", "inventory.field.expiryFromInstant"),
      hidden("expiry_before", "inventory.field.expiryBeforeInstant"),
    ],
  },
  locations: {
    ...base,
    filters: [
      text("search", "inventory.field.search"),
      pick("center", "inventory.field.center", CENTER_LOOKUP),
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
  sortOptions: [
    { value: "lot__code", labelKey: "inventory.field.code" },
    { value: "piece_id", labelKey: "inventory.field.piece" },
  ],
  filters: [
    text("lot", "inventory.field.code"),
    pick("supply", "inventory.field.supply", SUPPLY_LOOKUP),
  ],
};
export const MOVEMENT_TABLE: TableQueryConfig = {
  ...base,
  defaultOrdering: "-created_at",
  sortableIds: ["created_at", "lot_code", "quantity"],
  sortOptions: [
    { value: "created_at", labelKey: "inventory.field.createdAt" },
    { value: "lot_code", labelKey: "inventory.field.code" },
    { value: "quantity", labelKey: "inventory.field.movementQuantity" },
  ],
  filters: [
    hidden("lot", "inventory.field.linkedLot"),
    ...STOCK_TABLE.filters.filter((filter) => filter.key !== "lot"),
    text("lot_code", "inventory.field.code"),
    text("operation", "inventory.field.operation"),
    text("piece", "inventory.field.piece"),
    text("unit", "inventory.field.unit"),
    dateEnd("created_at_from", "inventory.field.movementFrom", { input: "date-from" }),
    dateEnd("created_at_before", "inventory.field.movementBefore", { input: "date-to" }),
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
