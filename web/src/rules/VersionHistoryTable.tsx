import { useTranslation } from "react-i18next";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import type { RuleParameterVersion } from "./rules-query";
import { useVersionHistoryTable } from "./use-version-history-table";
import type { VersionHistoryTableProps } from "./use-version-history-table";
const getVersionId = (version: RuleParameterVersion): string => version.id;
/** The shared table is embedded in the history Card to avoid a second outer frame. */
export function VersionHistoryTable(props: VersionHistoryTableProps) {
  const { t } = useTranslation();
  const table = useVersionHistoryTable(props);
  return (
    <>
      <FilterBar controller={table.controller} />
      <DataTable {...table} caption={t("rules.history.caption")} getRowId={getVersionId} embedded />
    </>
  );
}
