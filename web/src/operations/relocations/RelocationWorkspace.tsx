import { useQuery } from "@tanstack/react-query";
import { operationTableData } from "../read-access";
import { useTranslation } from "react-i18next";
import { DataTable } from "../../data-table/DataTable";
import { FilterBar } from "../../data-table/FilterBar";
import { useTableUrlState } from "../../data-table/use-table-url-state";
import { InlineNotice } from "../../ui/InlineNotice";
import { relocationListOptions, RELOCATION_PAGE_SIZE } from "./relocations-query";
import type { RelocationScope } from "./relocations-query";
import { RELOCATION_TABLE, relocationTableQuery } from "./relocation-table";
import { useRelocationColumns } from "./use-relocation-columns";
import { RelocationSheet } from "./RelocationSheet";
import styles from "./relocations.module.css";
const TABLE_SCOPE = { ignoredPrefixes: ["relocation"] };
export function RelocationWorkspace({ scope }: { scope: RelocationScope }) {
  const { t } = useTranslation();
  const controller = useTableUrlState(RELOCATION_TABLE, TABLE_SCOPE);
  const query = useQuery(relocationListOptions(scope, relocationTableQuery(controller.state)));
  const columns = useRelocationColumns();
  return (
    <section className={styles.page}>
      <h1>{t("relocations.workspace.title")}</h1>
      <InlineNotice tone="info">{t("relocations.workspace.defaultView")}</InlineNotice>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("relocations.workspace.title")}
        columns={columns}
        controller={controller}
        getRowId={(row) => row.id}
        data={operationTableData(query, controller.state.page, RELOCATION_PAGE_SIZE)}
        voidOf={(row) =>
          row.voided_at
            ? {
                reason: row.void_reason_code,
                note: row.void_reason,
                author: t("relocations.workspace.unavailable"),
              }
            : null
        }
      />
      <RelocationSheet scope={scope} />
    </section>
  );
}
