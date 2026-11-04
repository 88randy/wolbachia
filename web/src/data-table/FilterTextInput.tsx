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
      className={styles.control}
      defaultValue={value ?? ""}
      maxLength={filter.maxLength}
      autoComplete="off"
    />
  );
}
