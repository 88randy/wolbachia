import styles from "./filter-bar.module.css";
import type { TextFilter } from "./table-types";

interface FilterTextInputProps {
  id: string;
  filter: TextFilter;
  value: string | undefined;
}

/** Uncontrolled: the value is read from the form on submit, so typing makes no request. */
export function FilterTextInput({ id, filter, value }: FilterTextInputProps) {
  return (
    <input
      id={id}
      name={filter.key}
      type="text"
      inputMode={filter.format === "positive-integer" ? "numeric" : undefined}
      pattern={filter.format === "positive-integer" ? "[1-9][0-9]*" : undefined}
      className={styles.control}
      defaultValue={value ?? ""}
      maxLength={filter.maxLength}
      autoComplete="off"
    />
  );
}
