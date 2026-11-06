import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { tableErrorKey } from "../data-table/table-error";
import { ErrorState } from "../ui/ErrorState";
import styles from "./fleet.module.css";
export function FleetLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.content}>
      <ErrorState
        message={t(tableErrorKey(error))}
        code={error instanceof ApiError ? error.code : undefined}
        onRetry={onRetry}
      />
      <p className={styles.hint}>{t("fleet.record.refreshRequired")}</p>
    </div>
  );
}
