import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "../data-table/table-types";
import type { InventoryKind, InventoryRecord } from "./inventory-links";
import { StatusPill } from "../ui/StatusPill";
import { useFormatDateTime } from "../format/use-format-date-time";
import { blockerKeys } from "./inventory-fields";
import { inventoryRecordLink } from "./inventory-links";
import { formatInventoryQuantity } from "./format-inventory-quantity";
import { useLanguage } from "../i18n/use-language";
import { useCan } from "../session/use-can";
import { useSearch } from "@tanstack/react-router";
type Column = DataTableColumn<InventoryRecord>;
type Context = {
  t: (key: MessageKey) => string;
  format: ReturnType<typeof useFormatDateTime>;
  language: ReturnType<typeof useLanguage>["language"];
  canReadLocation: boolean;
};
function identityColumns(kind: InventoryKind, search: Record<string, string>): Column[] {
  return [
    {
      id: "code",
      headerKey: "inventory.field.code",
      cell: (row) => row.code,
      link: (row) => ({ ...inventoryRecordLink(kind, row.code), search }),
    },
    {
      id: "name",
      headerKey: "inventory.field.name",
      cell: (row) =>
        "label" in row ? row.label : "name" in row ? row.name : row.supply_version.label,
    },
  ];
}
function statusColumn(t: Context["t"]): Column {
  return {
    id: "status",
    headerKey: "inventory.field.status",
    cell: (row) => {
      if ("status" in row)
        return (
          <StatusPill tone={row.status === "available" ? "success" : "warning"}>
            {t(`inventory.status.${row.status}`)}
          </StatusPill>
        );
      return "is_active" in row
        ? t(row.is_active ? "inventory.status.active" : "inventory.status.inactive")
        : null;
    },
  };
}
function lotQuantity({ language, t, canReadLocation }: Context): Column {
  return {
    id: "quantity",
    headerKey: "inventory.field.quantity",
    align: "end",
    cell: (row) =>
      "quantity" in row && row.quantity
        ? formatInventoryQuantity(row.quantity, language)
        : t("inventory.state.unconfigured"),
    link: (row) =>
      "admission_id" in row && row.admission_id && row.location_version && canReadLocation
        ? {
            to: "/inventory/locations/$code",
            params: { code: row.location_version.code },
            search: { center: row.center, view: "movements", lot: row.id },
          }
        : undefined,
  };
}
function lotColumns(context: Context): Column[] {
  const { t, format } = context;
  return [
    {
      id: "expiry",
      headerKey: "inventory.field.expiry",
      cell: (row) =>
        "expiry" in row && row.expiry ? format(row.expiry) : t("inventory.state.unconfigured"),
    },
    lotQuantity(context),
    statusColumn(t),
    {
      id: "blocked_by",
      headerKey: "inventory.field.blocker",
      cell: (row) =>
        "blocked_by" in row
          ? row.blocked_by
              .map((item) => t(blockerKeys[item.reason] ?? "inventory.blocker.unknown"))
              .join(" ")
          : null,
    },
  ];
}
function locationSafety(row: InventoryRecord, t: Context["t"]) {
  if (!("is_insecticide_free" in row)) return null;
  const key =
    row.is_insecticide_free === null
      ? "inventory.state.unconfigured"
      : row.is_insecticide_free
        ? "inventory.option.yes"
        : "inventory.option.no";
  return t(key);
}
function locationColumns(t: Context["t"]): Column[] {
  return [
    {
      id: "owner",
      headerKey: "inventory.field.owner",
      cell: (row) => ("owner_label" in row ? row.owner_label : null),
    },
    {
      id: "coordinates",
      headerKey: "inventory.map.coordinates",
      cell: (row) => ("geometry" in row ? row.geometry.coordinates.join(", ") : null),
    },
    {
      id: "kind",
      headerKey: "inventory.field.kind",
      cell: (row) => ("kind" in row ? t(`inventory.option.${row.kind}`) : null),
    },
    {
      id: "safety",
      headerKey: "inventory.field.isInsecticideFree",
      cell: (row) => locationSafety(row, t),
    },
  ];
}
export function useInventoryColumns(kind: InventoryKind): Column[] {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const { language } = useLanguage();
  const canReadLocation = useCan()("location.read");
  const search = Object.fromEntries(
    Object.entries(useSearch({ strict: false })).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const columns = identityColumns(kind, search);
  if (kind === "lots") return [...columns, ...lotColumns({ t, format, language, canReadLocation })];
  if (kind === "locations") return [...columns, ...locationColumns(t)];
  return [
    ...columns,
    {
      id: "unit",
      headerKey: "inventory.field.unit",
      cell: (row: InventoryRecord) => ("unit" in row ? row.unit : null),
    },
    statusColumn(t),
  ];
}
