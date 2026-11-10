import { EntityName } from "../../lookups/EntityName";
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
        search: { custody_location: location.id },
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
const sourceLabels: Record<string, MessageKey> = {
  lot_admission: "inventory.option.admission",
  transfer_dispatch: "inventory.source.dispatch",
  transfer_receive: "inventory.source.receive",
  transfer_resolution: "inventory.source.resolution",
};
function TransferFacts({
  transfer,
  t,
}: {
  transfer: NonNullable<Schemas["Movement"]["source_transfer"]>;
  t: Context["t"];
}) {
  return (
    <p>
      {t("inventory.source.transfer")}: {transfer.code}
      <br />
      {t("inventory.source.transferId")}: <span>{transfer.id}</span>
      <br />
      {t("inventory.source.transferEvent")}: <span>{transfer.event_id}</span>
    </p>
  );
}
function sourceValue(row: StockRow, t: Context["t"]) {
  if (!("source_id" in row)) return null;
  return (
    <>
      {t(sourceLabels[row.source_kind] ?? "inventory.source.unknown")}
      <p>{row.source_id}</p>
      {row.source_transfer && <TransferFacts transfer={row.source_transfer} t={t} />}
    </>
  );
}
function provenanceColumns({ t, format }: Context): Column[] {
  return [
    {
      id: "movement",
      headerKey: "inventory.field.movementId",
      cell: (row) => ("id" in row ? row.id : null),
    },
    {
      id: "source",
      headerKey: "inventory.field.source",
      cell: (row) => sourceValue(row, t),
    },
    {
      id: "created_at",
      headerKey: "inventory.field.createdAt",
      cell: (row) => ("created_at" in row ? format(row.created_at) : null),
    },
    {
      id: "author",
      headerKey: "inventory.field.author",
      cell: (row) => ("created_by" in row ? <EntityName kind="user" id={row.created_by} /> : null),
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
