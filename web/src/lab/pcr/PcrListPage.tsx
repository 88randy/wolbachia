import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import type { DataTableColumn } from "../../data-table/table-types";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useFormatDate } from "../../format/use-formatters";
import { useCan } from "../../session/use-can";
import { buttonVariants } from "../../ui/button-variants";
import { EmptyValue } from "../../ui/EmptyValue";
import { StatusPill } from "../../ui/StatusPill";
import { useLabScope } from "../use-lab-scope";
import { PCR_MANAGE, PCR_TABLE, pcrListOptions } from "./pcr-api";
import type { PcrRow } from "./pcr-api";
import { STATUS_TONE, statusKey, targetKey } from "./pcr-status";

function useColumns(): DataTableColumn<PcrRow>[] {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  return [
    {
      id: "code",
      headerKey: "pcr.col.code",
      cell: (row) => <span className="font-semibold">{row.code}</span>,
      link: (row) => ({ to: "/lab/pcr/$code", params: { code: row.code } }),
    },
    { id: "lab", headerKey: "pcr.col.lab", cell: (row) => row.external_lab_name },
    { id: "samples", headerKey: "pcr.col.samples", align: "end", cell: (row) => row.sample_count },
    {
      id: "targets",
      headerKey: "pcr.col.targets",
      cell: (row) => row.targets.map((target) => t(targetKey(target))).join(" · "),
    },
    {
      id: "status",
      headerKey: "pcr.col.status",
      cell: (row) => <StatusPill tone={STATUS_TONE[row.status]}>{t(statusKey(row.status))}</StatusPill>,
    },
    {
      id: "shipped_at",
      headerKey: "pcr.col.shippedAt",
      cell: (row) =>
        row.shipped_at ? <time dateTime={row.shipped_at}>{formatDate(row.shipped_at)}</time> : <EmptyValue />,
    },
  ];
}

/** "Pruebas PCR": every batch sent (or to send) to an external laboratory. */
export function PcrListPage() {
  const { t } = useTranslation();
  const can = useCan();
  const scope = useLabScope();
  const controller = useTableUrlState(PCR_TABLE);
  const query = useQuery(pcrListOptions(scope, controller.state));
  const columns = useColumns();
  const counts = query.data?.status_counts ?? {};
  const quickCounts = {
    ...counts,
    "": Object.entries(counts)
      .filter(([status]) => status !== "voided")
      .reduce((sum, [, value]) => sum + value, 0),
  };
  const actions = can(PCR_MANAGE) ? (
    <div className="flex items-center gap-2">
      <Link to="/lab/pcr/labs" className={buttonVariants({ variant: "secondary", size: "md" })}>
        <Building2 aria-hidden="true" className="size-4" />
        {t("pcr.list.labs")}
      </Link>
      <Link to="/lab/pcr/new" className={buttonVariants({ variant: "primary", size: "md" })}>
        <Plus aria-hidden="true" className="size-4" />
        {t("pcr.list.new")}
      </Link>
    </div>
  ) : undefined;
  return (
    <ListPage title={t("pcr.list.title")} description={t("pcr.list.description")}>
      <FilterBar controller={controller} actions={actions} quickCounts={query.data ? quickCounts : undefined} />
      <DataTable
        caption={t("pcr.list.title")}
        columns={columns}
        getRowId={(row) => row.id}
        controller={controller}
        data={pageTableData(query, controller.state.page, PCR_TABLE.pageSize)}
      />
    </ListPage>
  );
}
