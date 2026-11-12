/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import type { DataTableColumn } from "../../data-table/table-types";
import { useFormatValidityEnd } from "../../format/use-format-date-time";
import { useFormatDate } from "../../format/use-formatters";
import { useRegList } from "../../regulatory/use-reg-list";
import { useCan } from "../../session/use-can";
import { API_KEY_MANAGE, API_KEY_TABLE, apiKeyOptions } from "./api-keys-queries";
import type { ApiKeyRow } from "./api-keys-queries";
import { ApiKeyCreateDialog } from "./ApiKeyCreateDialog";
import { ApiKeyRevokeDialog } from "./ApiKeyRevokeDialog";
import { ApiKeySecretDialog } from "./ApiKeySecretDialog";
import type { CreatedKey } from "./ApiKeySecretDialog";
import { ApiKeyStatus } from "./ApiKeyStatus";

/** W66: one key per institution. The secret is shown once, in the dialog after creating it. */
export function ApiKeysPage() {
  const { t } = useTranslation();
  const can = useCan();
  const formatDay = useFormatDate();
  const formatEnd = useFormatValidityEnd();
  const { controller, data } = useRegList(API_KEY_TABLE, apiKeyOptions);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const canManage = can(API_KEY_MANAGE);
  const columns: DataTableColumn<ApiKeyRow>[] = [
    {
      id: "institution",
      headerKey: "apiKeys.col.institution",
      cell: (row) => <strong>{row.institution}</strong>,
    },
    {
      id: "scope",
      headerKey: "apiKeys.col.scope",
      cell: (row) =>
        `${row.center_name} · ${(row.quadrant_code as string | null) ?? t("apiKeys.allQuadrants")}`,
    },
    {
      id: "endpoints",
      headerKey: "apiKeys.col.endpoints",
      cell: (row) =>
        (row.endpoints as string[])
          .map((code) => t(`apiKeys.endpoint.${code as "coverage"}`))
          .join(" · "),
    },
    {
      id: "limit",
      headerKey: "apiKeys.col.limit",
      align: "end",
      cell: (row) => t("apiKeys.limitPerDay", { count: row.rate_limit_per_day }),
    },
    {
      id: "validity",
      headerKey: "apiKeys.col.validity",
      cell: (row) =>
        t("apiKeys.validity", { from: formatDay(row.valid_from), to: formatEnd(row.valid_until) }),
    },
    {
      id: "status",
      headerKey: "apiKeys.col.status",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <ApiKeyStatus status={row.status} />
          {row.revoke_reason && (
            <span className="text-xs text-ink-2">
              {t("apiKeys.revokedReason", { reason: row.revoke_reason })}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "author",
      headerKey: "apiKeys.col.author",
      cell: (row) => row.created_by_name ?? t("apiKeys.system"),
    },
  ];
  return (
    <ListPage title={t("apiKeys.title")} description={t("apiKeys.description")}>
      <FilterBar
        controller={controller}
        actions={
          canManage ? (
            <ApiKeyCreateDialog
              onCreated={(key) => {
                setCreated(key);
              }}
            />
          ) : undefined
        }
      />
      <DataTable
        caption={t("apiKeys.title")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={data}
        rowActions={
          canManage
            ? (row) =>
                row.status === "active" || row.status === "scheduled" ? (
                  <ApiKeyRevokeDialog row={row} />
                ) : null
            : undefined
        }
      />
      {created !== null && (
        <ApiKeySecretDialog
          created={created}
          onClose={() => {
            setCreated(null);
          }}
        />
      )}
    </ListPage>
  );
}
