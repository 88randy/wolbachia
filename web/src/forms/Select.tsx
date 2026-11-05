import type { ComponentPropsWithoutRef } from "react";
import { FieldNotes } from "./FieldNotes";
import styles from "./form.module.css";
interface SelectProps extends Omit<ComponentPropsWithoutRef<"select">, "id" | "className"> {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  error?: string;
  hint?: string;
}
export function Select({ id, label, options, error, hint, ...props }: SelectProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select
        {...props}
        id={id}
        className={styles.control}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={
          error !== undefined ? `${id}-error` : hint !== undefined ? `${id}-hint` : undefined
        }
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
}
