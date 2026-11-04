import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { useDocumentTitle } from "../shell/use-document-title";
import page from "../styles/page.module.css";
import { phonesQueryOptions } from "./phones-query";
import type { Phone } from "./phones-query";
import { PHONES_PAGE_SIZE, PHONES_TABLE } from "./phones-table";
import styles from "./phones.module.css";
import { usePhoneColumns } from "./use-phone-columns";

const getPhoneId = (phone: Phone): string => phone.id;

/**
 * W67, the phones part: the registered phones of the organization, read only. Built on the shared
 * `FilterBar` and `DataTable`; the address holds the filter and the page. The app-version cards,
 * the APK upload and revoking a phone are other issues and are not drawn here.
 */
export function PhonesPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("phones.page.title"));
  const client = useApiClient();
  const controller = useTableUrlState(PHONES_TABLE);
  const columns = usePhoneColumns();
  const query = useQuery({
    ...phonesQueryOptions(client, controller.state),
    placeholderData: keepPreviousData,
  });
  return (
    <section className={page.page}>
      <h1 className={page.title}>{t("phones.page.title")}</h1>
      <p className={styles.hint}>{t("phones.page.hint")}</p>
      <div className={styles.content}>
        <FilterBar controller={controller} />
        <DataTable
          caption={t("phones.table.caption")}
          columns={columns}
          getRowId={getPhoneId}
          controller={controller}
          data={pageTableData(query, controller.state.page, PHONES_PAGE_SIZE)}
        />
      </div>
    </section>
  );
}
