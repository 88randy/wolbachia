import { useId } from "react";
import { useTranslation } from "react-i18next";
import styles from "./filter-bar.module.css";
import type { SelectFilter } from "./table-types";

interface FilterSelectProps {
  filter: SelectFilter;
  /** Current value in the URL, `undefined` when the filter is off. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/** A native `<select>`: keyboard, screen readers and mobile pickers work without extra code. */
export function FilterSelect({ filter, value, onChange }: FilterSelectProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {t(filter.labelKey)}
      </label>
      <select
        id={id}
        className={styles.control}
        value={value ?? ""}
        onChange={(event) => {
          onChange(event.target.value === "" ? undefined : event.target.value);
        }}
      >
        <option value="">{t("table.filters.all")}</option>
        {filter.options.map((option) => (
          <option key={option.value} value={option.value}>
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
