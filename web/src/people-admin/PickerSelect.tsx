import styles from "../void/void-dialog.module.css";

interface Props {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** Native single-choice select with its label, in the shared dialog look. */
export function PickerSelect({ id, label, placeholder, value, options, onChange }: Props) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={styles.select}
        value={value}
        required
        onChange={(event) => {
          onChange(event.target.value);
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
