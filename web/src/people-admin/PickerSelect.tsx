import { Combobox } from "../ui/Combobox";
import styles from "../void/void-dialog.module.css";

interface Props {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** A label above one searchable picker, in the shared dialog look. */
export function PickerSelect({ id, label, placeholder, value, options, onChange }: Props) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <Combobox
        id={id}
        value={value}
        options={options}
        placeholder={placeholder}
        onValueChange={onChange}
      />
    </div>
  );
}
