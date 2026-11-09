import { useTranslation } from "react-i18next";
import styles from "./fleet.module.css";
export function FleetProvenance({ value }: { value: unknown }) {
  const { t } = useTranslation();
  if (value === null || value === undefined) return <span>{t("fleet.summary.unknown")}</span>;
  return (
    <details>
      <summary>{t("fleet.history.provenance")}</summary>
      <pre className={styles.provenance}>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
