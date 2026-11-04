import { useId } from "react";
import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import { FilterTextInput } from "./FilterTextInput";
import styles from "./filter-bar.module.css";
import type { TextFilter } from "./table-types";

interface FilterTextProps {
  filter: TextFilter;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/** What the user typed in the field `name`, trimmed; `undefined` when it is blank. */
function typedValue(form: HTMLFormElement, name: string): string | undefined {
  const typed = new FormData(form).get(name);
  const text = typeof typed === "string" ? typed.trim() : "";
  return text === "" ? undefined : text;
}

/**
 * A text filter applies on Enter or on "Apply", not on every keystroke: each change is a new
 * request and a new history entry. The field is remounted when the filter changes from outside
 * (a chip removed, "Clear filters") so it never shows a stale value.
 */
export function FilterText({ filter, value, onChange }: FilterTextProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <form
      key={value ?? ""}
      className={styles.field}
      onSubmit={(event) => {
        event.preventDefault();
        onChange(typedValue(event.currentTarget, filter.key));
      }}
    >
      <label htmlFor={id} className={styles.label}>
        {t(filter.labelKey)}
      </label>
      <div className={styles.inline}>
        <FilterTextInput id={id} filter={filter} value={value} />
        <button type="submit" className={classNames(buttons.button, buttons.secondary)}>
          {t("table.filters.apply")}
        </button>
      </div>
    </form>
  );
}
