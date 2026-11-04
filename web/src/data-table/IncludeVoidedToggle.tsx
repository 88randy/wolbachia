import { useTranslation } from "react-i18next";
import styles from "./filter-bar.module.css";

interface IncludeVoidedToggleProps {
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}

/** Voided records are hidden unless asked for (`?include_voided=true`). */
export function IncludeVoidedToggle({ isOn, onChange }: IncludeVoidedToggleProps) {
  const { t } = useTranslation();
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        className={styles.check}
        checked={isOn}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      {t("table.filters.includeVoided")}
    </label>
  );
}
