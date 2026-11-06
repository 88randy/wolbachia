import { useTranslation } from "react-i18next";
import styles from "./data-table.module.css";
export type TableDensityValue = "comfortable" | "compact";
export function TableDensity({
  value,
  onChange,
}: {
  value: TableDensityValue;
  onChange: (value: TableDensityValue) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className={styles.density}>
      {t("refresh.table.density")}
      <select
        value={value}
        onChange={(event) => {
          if (
            event.currentTarget.value === "compact" ||
            event.currentTarget.value === "comfortable"
          )
            onChange(event.currentTarget.value);
        }}
      >
        <option value="comfortable">{t("refresh.table.comfortable")}</option>
        <option value="compact">{t("refresh.table.compact")}</option>
      </select>
    </label>
  );
}
