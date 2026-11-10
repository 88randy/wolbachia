import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { ReceptionSummaryCount } from "./ReceptionSummaryCount";
import type { TableState } from "../data-table/table-types";
import styles from "./reception.module.css";
export function ReceptionSummary({ state }: { state: TableState }) {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <section aria-label={t("labReception.summary.hint")}>
      <div className={styles.summary}>
        <ReceptionSummaryCount state={state} kind="received" />
        {can("reading.read") && <ReceptionSummaryCount state={state} kind="expected" />}
      </div>
      <p>{t("labReception.summary.hint")}</p>
    </section>
  );
}
