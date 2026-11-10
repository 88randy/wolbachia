import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useSessionIdentity } from "../session/use-session-identity";
import { ListPage } from "../components/templates/ListPage";
import { phonesQueryOptions } from "./phones-query";
import type { Phone } from "./phones-query";
import { PHONES_PAGE_SIZE, phonesTableFor } from "./phones-table";
import { useMe } from "../session/use-me";
import { usePhoneColumns } from "./use-phone-columns";

const getPhoneId = (phone: Phone): string => phone.id;

/**
 * W67, the phones part: the registered phones of the organization, read only. Built on the shared
 * `FilterBar` and `DataTable`; the address holds the filter and the page. The app-version cards,
 * the APK upload and revoking a phone are other issues and are not drawn here.
 */
export function PhonesPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const controller = useTableUrlState(phonesTableFor(useMe().user.id));
  const columns = usePhoneColumns();
  const identity = useSessionIdentity();
  const query = useQuery(phonesQueryOptions(client, identity, controller.state));
  return (
    <ListPage title={t("phones.page.title")} description={t("phones.page.hint")}>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("phones.table.caption")}
        columns={columns}
        getRowId={getPhoneId}
        controller={controller}
        data={pageTableData(query, controller.state.page, PHONES_PAGE_SIZE)}
      />
    </ListPage>
  );
}
