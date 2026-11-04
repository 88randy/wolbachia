import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { DataTable } from "../data-table/DataTable";
import { FilterBar } from "../data-table/FilterBar";
import { pageTableData } from "../data-table/table-data";
import { useTableUrlState } from "../data-table/use-table-url-state";
import { FormNotice } from "../forms/FormNotice";
import { useFormatDateTime } from "../format/use-format-date-time";
import { voidInfoOf } from "../void";
import { hideVoidedVersions } from "./hide-voided-versions";
import { versionsQueryOptions } from "./rules-query";
import type { RuleParameter, RuleParameterVersion } from "./rules-query";
import { VERSIONS_PAGE_SIZE, VERSIONS_TABLE } from "./rules-table";
import styles from "./rules.module.css";
import { useAuthorLabel } from "./use-author-label";
import { useVersionColumns } from "./use-version-columns";
import { VoidVersionDialog } from "./VoidVersionDialog";

const NOTE_ID = "rule-history-void-note";
const TITLE_ID = "rule-history-title";
const getVersionId = (version: RuleParameterVersion): string => version.id;

interface VersionHistoryProps {
  parameter: RuleParameter;
  /** The user holds `rule_parameter_version.void`. */
  canVoid: boolean;
}

function HistoryHeader({ canVoid }: { canVoid: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={styles.historyHeader}>
      <h2 id={TITLE_ID} className={styles.cardTitle}>
        {t("rules.history.title")}
      </h2>
      <p className={styles.hint}>{t("rules.history.hint")}</p>
      {canVoid && (
        <p id={NOTE_ID} className={styles.voidBlocked}>
          {t("rules.history.voidBlocked")}
        </p>
      )}
    </div>
  );
}

interface HistoryTableProps extends VersionHistoryProps {
  onVoid: (version: RuleParameterVersion) => void;
}

/** Filter bar ("Include voided") and table of the versions of the page in view. */
function HistoryTable({ parameter, canVoid, onVoid }: HistoryTableProps) {
  const { t } = useTranslation();
  const client = useApiClient();
  const controller = useTableUrlState(VERSIONS_TABLE);
  const query = useQuery(versionsQueryOptions(client, parameter.key, controller.state));
  const columns = useVersionColumns({ parameter, canVoid, onVoid, blockedNoteId: NOTE_ID });
  const authorLabel = useAuthorLabel();
  const formatDateTime = useFormatDateTime();
  const rows = pageTableData(query, controller.state.page, VERSIONS_PAGE_SIZE);
  return (
    <>
      <FilterBar controller={controller} />
      <DataTable
        caption={t("rules.history.caption")}
        columns={columns}
        getRowId={getVersionId}
        controller={controller}
        data={hideVoidedVersions(rows, controller.state.includeVoided)}
        voidOf={(version) => voidInfoOf(version, authorLabel, formatDateTime)}
      />
    </>
  );
}

/**
 * The history of one parameter, read only: every version with its value, day, status, reason,
 * author and date, newest first. Voided versions are hidden until "Include voided" is on, then
 * shown struck through with their reason and author. A scheduled version can be voided from here
 * (the shared dialog); the ones that took effect cannot, and the button says why.
 */
export function VersionHistory({ parameter, canVoid }: VersionHistoryProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<RuleParameterVersion>();
  const [isDone, setIsDone] = useState(false);
  const open = useCallback((version: RuleParameterVersion) => {
    setIsDone(false);
    setTarget(version);
  }, []);
  return (
    <section className={styles.card} aria-labelledby={TITLE_ID}>
      <HistoryHeader canVoid={canVoid} />
      {isDone && <FormNotice title={t("rules.history.voidDone")} shouldFocus />}
      <HistoryTable parameter={parameter} canVoid={canVoid} onVoid={open} />
      {target !== undefined && (
        <VoidVersionDialog
          parameterKey={parameter.key}
          version={target}
          onCancel={() => {
            setTarget(undefined);
          }}
          onVoided={() => {
            setTarget(undefined);
            setIsDone(true);
          }}
        />
      )}
    </section>
  );
}
