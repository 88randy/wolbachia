import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { SelectFilter } from "./table-types";
import styles from "./filter-bar.module.css";
interface Props {
  filter: SelectFilter;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}
/** A visible availability choice with native button keyboard behavior and announced pressed state. */
export function FilterSegments({ filter, value, onChange }: Props) {
  const { t } = useTranslation();
  const options = [{ value: "", labelKey: "table.filters.all" } as const, ...filter.options];
  return (
    <fieldset className={styles.segmentField}>
      <legend className={styles.label}>{t(filter.labelKey)}</legend>
      <div className={styles.segments}>
        {options.map((option) => (
          <Button
            key={option.value}
            size="md"
            variant={(value ?? "") === option.value ? "primary" : "secondary"}
            aria-pressed={(value ?? "") === option.value}
            onClick={() => {
              onChange(option.value || undefined);
            }}
          >
            {t(option.labelKey)}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
