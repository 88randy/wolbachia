import { Link } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useLanguage } from "../../i18n/use-language";
import { movementFiltersOf } from "../inventory-links";
import { formatInventoryQuantity } from "../format-inventory-quantity";
export type StockRow = Schemas["Stock"] | Schemas["Movement"];
type Column = DataTableColumn<StockRow>;
type Context = {
  location: Schemas["Location"];
  movements: boolean;
  t: (key: MessageKey) => string;
  language: ReturnType<typeof useLanguage>["language"];
  format: ReturnType<typeof useFormatDateTime>;
};
function ledgerSearch(row: StockRow) {
  return "lot" in row
    ? movementFiltersOf(row)
    : { lot: row.lot_id, piece: row.piece_id ?? "none", unit: row.unit };
}
function operationColumn(location: Schemas["Location"]): Column {
  return {
    id: "operation",
    headerKey: "inventory.field.operation",
    cell: (row) =>
      ("source_ids" in row ? row.source_ids : [row.operation_id]).map((operation) => (
        <Link
          key={operation}
          to="/inventory/locations/$code"
          params={{ code: location.code }}
          search={{ center: location.center, view: "movements", ...ledgerSearch(row), operation }}
        >
          {operation}
        </Link>
      )),
  };
}
function quantityColumn(context: Context): Column {
  const { location, movements, language } = context;
  const link: Column["link"] = movements
    ? undefined
    : (row) => ({
        to: "/inventory/locations/$code",
        params: { code: location.code },
        search: { center: location.center, view: "movements", ...ledgerSearch(row) },
      });
  return {
    id: "quantity",
    headerKey: movements ? "inventory.field.movementQuantity" : "inventory.field.availableQuantity",
    align: "end",
    cell: (row) => formatInventoryQuantity(row.quantity, language),
    link,
  };
}
function identityColumns(context: Context): Column[] {
  const { t, movements, location } = context;
  return [
    {
      id: movements ? "lot_code" : "lot__code",
      headerKey: "inventory.field.code",
      cell: (row) => row.lot_code,
      link: (row) => ({
        to: "/inventory/lots/$code",
        params: { code: row.lot_code },
        search: { center: location.center },
      }),
    },
    quantityColumn(context),
    unitColumn,
    {
      id: "piece_id",
      headerKey: "inventory.field.piece",
      cell: (row) => row.piece_id ?? t("inventory.option.none"),
    },
    operationColumn(location),
  ];
}
const unitColumn: Column = {
  id: "unit",
  headerKey: "inventory.field.unit",
  cell: (row) => (
    <>
      {row.unit}
      {"unit_version_id" in row && <small>{row.unit_version_id}</small>}
    </>
  ),
};
function provenanceColumns({ t, format }: Context): Column[] {
  return [
    {
      id: "source",
      headerKey: "inventory.field.source",
      cell: (row) =>
        "source_id" in row ? (
          <>
            {t("inventory.option.admission")}
            <p>{row.source_id}</p>
          </>
        ) : null,
    },
    {
      id: "created_at",
      headerKey: "inventory.field.createdAt",
      cell: (row) => ("created_at" in row ? format(row.created_at) : null),
    },
    {
      id: "author",
      headerKey: "inventory.field.author",
      cell: (row) =>
        "created_by" in row ? (row.created_by ?? t("inventory.option.unknownAuthor")) : null,
    },
  ];
}
export function useStockColumns(location: Schemas["Location"], movements: boolean) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const format = useFormatDateTime();
  const context = { location, movements, t, language, format };
  return [...identityColumns(context), ...(movements ? provenanceColumns(context) : [])];
}
