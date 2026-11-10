/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../components/templates/ListPage";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import type { DataTableColumn } from "../data-table/table-types";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useFormatDate, useFormatNumber } from "../format/use-formatters";
import { buttonVariants } from "../ui/button-variants";
import { PLATFORM_PAGE_SIZE, PLATFORM_TABLE, platformListOptions } from "./platform-queries";
import type { PlatformOrganization } from "./platform-queries";
import { OrganizationStatus } from "./OrganizationStatus";
import { usePlatformScope } from "./use-platform";

/** Organizations of the platform: search, status tabs, sortable columns, row opens the detail. */
export function OrganizationsPage() {
  const { t } = useTranslation();
  const scope = usePlatformScope();
  const formatDate = useFormatDate();
  const formatNumber = useFormatNumber();
  const controller = useTableUrlState(PLATFORM_TABLE);
  const query = useQuery({
    ...platformListOptions(scope, controller.state),
    enabled: scope.identity.isSettled,
  });
  const columns: DataTableColumn<PlatformOrganization>[] = [
    {
      id: "name",
      headerKey: "platform.col.name",
      cell: (row) => (
        <Link
          to="/platform/$slug"
          params={{ slug: row.slug }}
          className="flex items-center gap-3 font-semibold text-ink no-underline hover:text-action"
        >
          <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-tint text-action">
            <Building2 aria-hidden="true" className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{row.name}</span>
            <span className="text-xs font-normal text-ink-3">{row.slug}</span>
          </span>
        </Link>
      ),
    },
    {
      id: "is_active",
      headerKey: "platform.col.status",
      cell: (row) => <OrganizationStatus isActive={row.is_active} />,
    },
    {
      id: "users_count",
      headerKey: "platform.col.users",
      align: "end",
      cell: (row) => formatNumber(row.users_count),
    },
    {
      id: "centers_count",
      headerKey: "platform.col.centers",
      align: "end",
      cell: (row) => formatNumber(row.centers_count),
    },
    {
      id: "created_at",
      headerKey: "platform.col.created",
      cell: (row) => formatDate(row.created_at),
    },
  ];
  return (
    <ListPage title={t("platform.list.title")} description={t("platform.list.description")}>
      <FilterBar
        controller={controller}
        actions={
          <Link to="/platform/new-organization" className={buttonVariants({ variant: "primary" })}>
            <Plus aria-hidden="true" className="size-4" />
            {t("platform.list.new")}
          </Link>
        }
      />
      <DataTable
        caption={t("platform.list.caption")}
        columns={columns}
        getRowId={(row) => row.slug}
        controller={controller}
        data={pageTableData(query, controller.state.page, PLATFORM_PAGE_SIZE)}
      />
    </ListPage>
  );
}
