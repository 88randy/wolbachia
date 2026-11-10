import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { DataTable } from "../../data-table/DataTable";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatDate } from "../../format/use-formatters";
import { useCan } from "../../session/use-can";
import { ListToolbar } from "../toolbar/ListToolbar";
import { TRANSFER_TABLE, transferOptions } from "../reg-queries";
import type { TransferRow } from "../reg-queries";
import { useRegList } from "../use-reg-list";
import { TransferCreateDialog } from "./TransferCreateDialog";
import { TransferRevokeDialog } from "./TransferRevokeDialog";
import { TransferStatus } from "./TransferStatus";

const STATUSES = ["active", "scheduled", "expired", "revoked"] as const;

/** W59: authorizations for personal data leaving the platform. */
export function DataTransfersPage() {
  const { t } = useTranslation();
  const can = useCan();
  const format = useFormatDate();
  const { controller, data } = useRegList(TRANSFER_TABLE, transferOptions);
  const canManage = can("transfer_authorization.manage");
  const columns: DataTableColumn<TransferRow>[] = [
    {
      id: "institution",
      headerKey: "regulatory.transfers.col.institution",
      cell: (row) => (
        <span className="flex flex-col">
          <strong>{row.recipient_institution}</strong>
          <span className="text-xs text-ink-2">{row.reference}</span>
        </span>
      ),
    },
    {
      id: "scope",
      headerKey: "regulatory.transfers.col.scope",
      cell: (row) =>
        row.quadrant_code
          ? `${row.center_name} · ${row.quadrant_code}`
          : `${row.center_name} · ${t("regulatory.transfers.allQuadrants")}`,
    },
    {
      id: "fields",
      headerKey: "regulatory.transfers.col.fields",
      cell: (row) =>
        (Array.isArray(row.fields) ? (row.fields as string[]) : [])
          .map((field) => (field === "rfc" ? t("regulatory.transfers.field.rfc") : field))
          .join(", "),
    },
    {
      id: "validity",
      headerKey: "regulatory.transfers.col.validity",
      cell: (row) => `${format(row.valid_from)} – ${format(row.valid_until)}`,
    },
    {
      id: "status",
      headerKey: "regulatory.transfers.col.status",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <TransferStatus status={row.status} />
          {row.revocation_reason && (
            <span className="text-xs text-ink-2">
              {t("regulatory.transfers.revokedReason", { reason: row.revocation_reason })}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "author",
      headerKey: "regulatory.transfers.col.author",
      cell: (row) => row.created_by_name ?? t("regulatory.access.system"),
    },
  ];
  return (
    <ListPage
      title={t("regulatory.transfers.title")}
      description={t("regulatory.transfers.description")}
    >
      <ListToolbar
        controller={controller}
        search={{ key: "search", label: t("regulatory.transfers.searchLabel") }}
        segments={{
          key: "status",
          label: t("regulatory.transfers.statusLabel"),
          options: STATUSES.map((value) => ({
            value,
            label: t(`regulatory.transfers.status.${value}`),
          })),
        }}
        actions={canManage ? <TransferCreateDialog /> : undefined}
      />
      <DataTable
        caption={t("regulatory.transfers.title")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={data}
        rowActions={
          canManage
            ? (row) =>
                row.status === "active" || row.status === "scheduled" ? (
                  <TransferRevokeDialog row={row} />
                ) : null
            : undefined
        }
      />
    </ListPage>
  );
}
