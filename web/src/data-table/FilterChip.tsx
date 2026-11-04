import type { TFunction } from "i18next";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./filter-bar.module.css";
import type { FilterDefinition } from "./table-types";

function valueLabel(filter: FilterDefinition, value: string, t: TFunction): string {
  if (filter.kind === "text") return value;
  const option = filter.options.find((candidate) => candidate.value === value);
  return option === undefined ? value : t(option.labelKey);
}

interface FilterChipProps {
  filter: FilterDefinition;
  value: string;
  onRemove: () => void;
}

/** One active filter as a button named "Remove filter <name>: <value>". */
export function FilterChip({ filter, value, onRemove }: FilterChipProps) {
  const { t } = useTranslation();
  const name = t(filter.labelKey);
  const text = valueLabel(filter, value, t);
  return (
    <button
      type="button"
      className={styles.chip}
      aria-label={t("table.filters.remove", { filter: name, value: text })}
      onClick={onRemove}
    >
      {name}: {text}
      <X className={styles.icon} aria-hidden="true" />
    </button>
  );
}
