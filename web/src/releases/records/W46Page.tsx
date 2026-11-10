import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { ListPage } from "../../components/templates/ListPage";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { pageTableData } from "../../data-table/table-data";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { useSessionIdentity } from "../../session/use-session-identity";
import { ReleasesActions } from "./ReleasesActions";
import { RELEASES_PAGE_SIZE, RELEASES_TABLE, releasesOptions } from "./releases-query";
import type { Release } from "./releases-query";
import { useReleaseColumns } from "./use-release-columns";

const getReleaseId = (row: Release): string => row.id;

/**
 * W46, releases. Accepted releases and the ones still in review, newest first, with the permit,
 * lot, device and quadrant each came from. Paging and order run on the server.
 */
export function W46Page() {
  const { t } = useTranslation();
  const controller = useTableUrlState(RELEASES_TABLE);
  const query = useQuery(releasesOptions(useApiClient(), useSessionIdentity(), controller.state));
  return (
    <ListPage title={t("releases.records.title")} actions={<ReleasesActions />}>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("releases.records.caption")}
        columns={useReleaseColumns()}
        getRowId={getReleaseId}
        controller={controller}
        data={pageTableData(query, controller.state.page, RELEASES_PAGE_SIZE)}
      />
    </ListPage>
  );
}
