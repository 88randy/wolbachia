import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SelectMenu } from "../ui/SelectMenu";
import styles from "./filter-bar.module.css";
import type { SelectFilter } from "./table-types";

interface FilterSelectProps {
  filter: SelectFilter;
  /** Current value in the URL, `undefined` when the filter is off. */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/** One filter dropdown; "All" clears the filter from the URL. */
export function FilterSelect({ filter, value, onChange }: FilterSelectProps) {
  const { t } = useTranslation();
  const id = useId();
  const options = [
    { value: "", label: t("table.filters.all") },
    ...filter.options.map((option) => ({ value: option.value, label: t(option.labelKey) })),
  ];
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {t(filter.labelKey)}
      </label>
      <SelectMenu
        id={id}
        className="min-w-40"
        value={value ?? ""}
        options={options}
        onValueChange={(next) => {
          onChange(next === "" ? undefined : next);
        }}
      />
    </div>
  );
}
