import { useCan } from "../../session/use-can";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatCalendarDate } from "../../format/use-formatters";
import { useLanguage } from "../../i18n/use-language";
import { StatusPill } from "../../ui/StatusPill";
import { formatInventoryQuantity } from "../format-inventory-quantity";
import { LabName } from "../../lab/LabName";
import { courierLabel, lotLabel } from "./allocation-labels";
import type { CourierEntry, WriteOff } from "./allocation-query";

interface Directories {
  lots: readonly Schemas["Lot"][] | undefined;
  people: readonly CourierEntry[] | undefined;
}
type Column = DataTableColumn<WriteOff>;

function RpbiPill({ isVerified }: { isVerified: boolean }) {
  const { t } = useTranslation();
  return isVerified ? (
    <StatusPill tone="success">{t("allocation.writeOff.rpbiVerified")}</StatusPill>
  ) : (
    <StatusPill tone="neutral">{t("allocation.writeOff.rpbiNotRequired")}</StatusPill>
  );
}

function targetColumns(lots: Directories["lots"], canReadLots: boolean): Column[] {
  return [
    {
      id: "target",
      headerKey: "allocation.writeOff.fieldTarget",
      cell: (row) =>
        row.kind === "lot" ? lotLabel(lots, row.lot_id) : <LabName kind="bag" id={row.bag_id} />,
      link: (row) => (row.kind === "lot" && canReadLots ? { to: "/inventory/lots" } : undefined),
    },
    { id: "reason", headerKey: "allocation.field.reason", cell: (row) => row.reason_code },
  ];
}

export function useWriteOffColumns({ lots, people }: Directories) {
  const { language } = useLanguage();
  const formatDay = useFormatCalendarDate();
  const [target, reason] = targetColumns(lots, useCan()("lot.read"));
  const quantity = (row: WriteOff) =>
    row.kind === "lot" ? formatInventoryQuantity(row.quantity, language) : "—";
  const columns: Column[] = [
    { id: "date", headerKey: "allocation.writeOff.fieldDate", cell: (row) => formatDay(row.date) },
    ...(target ? [target] : []),
    {
      id: "quantity",
      headerKey: "allocation.writeOff.fieldQuantity",
      align: "end",
      cell: quantity,
    },
    ...(reason ? [reason] : []),
    {
      id: "owner",
      headerKey: "allocation.writeOff.fieldOwner",
      cell: (row) => courierLabel(people, row.owner_id),
    },
    {
      id: "rpbi",
      headerKey: "allocation.writeOff.rpbiColumn",
      cell: (row) => <RpbiPill isVerified={Boolean(row.rpbi_upload_id)} />,
    },
  ];
  return columns;
}
