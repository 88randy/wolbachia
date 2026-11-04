import styles from "./data-table.module.css";

interface RowCheckboxProps {
  label: string;
  isChecked: boolean;
  /** Some but not all rows: the "select all" box of the header. */
  isMixed?: boolean;
  isDisabled?: boolean;
  onChange: (isChecked: boolean) => void;
}

/** A native checkbox: keyboard (Space), screen readers and the 24 px target come for free. */
export function RowCheckbox({
  label,
  isChecked,
  isMixed = false,
  isDisabled = false,
  onChange,
}: RowCheckboxProps) {
  return (
    <input
      type="checkbox"
      className={styles.check}
      aria-label={label}
      checked={isChecked}
      disabled={isDisabled}
      ref={(element) => {
        if (element) element.indeterminate = isMixed;
      }}
      onChange={(event) => {
        onChange(event.target.checked);
      }}
    />
  );
}
