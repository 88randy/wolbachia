import { useNavigate, useSearch } from "@tanstack/react-router";
import { useLanguage } from "../src/i18n/use-language";
import { useTranslation } from "react-i18next";
import { DataTable } from "../src/data-table/DataTable";
import { useTableUrlState } from "../src/data-table/use-table-url-state";
import type { DataTableColumn } from "../src/data-table/table-types";
import { RelativeTime } from "../src/analytics/RelativeTime";
import { StatusPill } from "../src/ui/StatusPill";
import { FolderTabs } from "../src/ui/FolderTabs";
import { PREVIEW_CONFIG, PREVIEW_NOW, PREVIEW_ROWS } from "./preview-table-data";
import type { PreviewRecord } from "./preview-table-data";
import { PreviewRowActions } from "./PreviewRowActions";
const STATUS_KEYS = {
  success: "good",
  warning: "warning",
  critical: "critical",
  info: "info",
  neutral: "neutral",
} as const;
export function PreviewTable() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const controller = useTableUrlState(PREVIEW_CONFIG);
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const tab = typeof search["tab"] === "string" ? search["tab"] : "all";
  const density = search["density"] === "compact" ? "compact" : "comfortable";
  const columns: DataTableColumn<PreviewRecord>[] = [
    { id: "code", headerKey: "refresh.preview.code", cell: (row) => <strong>{row.id}</strong> },
    { id: "center", headerKey: "refresh.preview.center", cell: (row) => row.center },
    {
      id: "date",
      headerKey: "refresh.preview.updated",
      cell: (row) => (
        <RelativeTime dateTime={row.date} now={PREVIEW_NOW} timeZone="America/Mexico_City" />
      ),
    },
    {
      id: "status",
      headerKey: "refresh.preview.status",
      cell: (row) => (
        <StatusPill tone={row.status}>{t(`refresh.preview.${STATUS_KEYS[row.status]}`)}</StatusPill>
      ),
    },
    {
      id: "count",
      headerKey: "refresh.preview.count",
      align: "end",
      cell: (row) => row.count,
      link: () => ({ to: "/operations" }),
    },
  ];
  const rows =
    tab === "review" ? PREVIEW_ROWS.filter((row) => row.status === "critical") : PREVIEW_ROWS;
  const table = (
    <DataTable
      caption={t("refresh.preview.records")}
      columns={columns}
      getRowId={(row) => row.id}
      controller={controller}
      data={{
        rows,
        paging: { mode: "page", page: 1, pageSize: 10, count: rows.length },
        isLoading: false,
        isFetching: false,
        error: null,
        refetch: () => undefined,
      }}
      density={density}
      onDensityChange={(next) => {
        void navigate({ to: ".", search: (previous) => ({ ...previous, density: next }) });
      }}
      groupOf={(row) => ({
        id: row.date.slice(0, 10),
        label: row.date.startsWith("2026-11-05")
          ? t("refresh.preview.today")
          : row.date.startsWith("2026-11-04")
            ? t("refresh.preview.yesterday")
            : new Intl.DateTimeFormat(language, {
                dateStyle: "medium",
                timeZone: "America/Mexico_City",
              }).format(new Date(row.date)),
      })}
      renderDetail={() => <p>{t("refresh.preview.details")}</p>}
      rowActions={(row) => <PreviewRowActions record={row} />}
      voidOf={(row) =>
        "isVoided" in row
          ? {
              reason: t("refresh.preview.voidReason"),
              author: t("refresh.preview.voidAuthor"),
            }
          : null
      }
    />
  );
  return (
    <FolderTabs
      label={t("refresh.preview.records")}
      value={tab}
      onValueChange={(next) => {
        void navigate({ to: ".", search: (previous) => ({ ...previous, tab: next }) });
      }}
      items={[
        { value: "all", label: t("refresh.preview.all"), content: table },
        { value: "review", label: t("refresh.preview.review"), content: table },
      ]}
    />
  );
}
