import type { ChangeEvent, ComponentPropsWithoutRef, FocusEvent } from "react";
import { SelectMenu } from "../ui/SelectMenu";
import { FieldNotes } from "./FieldNotes";
import styles from "./form.module.css";
interface SelectProps extends Omit<ComponentPropsWithoutRef<"select">, "id" | "className"> {
  id: string;
  label: string;
  options: readonly { value: string; label: string }[];
  error?: string;
  hint?: string;
  hideLabel?: boolean;
}
/** Callers keep the native `onChange(event)` contract; the control itself is the shared SelectMenu. */
function changeEvent(value: string) {
  const target = { value };
  return { target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>;
}
function currentValue({ value, defaultValue }: Pick<SelectProps, "value" | "defaultValue">) {
  if (typeof value === "string") return value;
  return typeof defaultValue === "string" ? defaultValue : "";
}
export function Select(props: SelectProps) {
  const { id, label, options, error, hint, hideLabel = false } = props;
  const describedBy =
    error !== undefined ? `${id}-error` : hint !== undefined ? `${id}-hint` : undefined;
  const value = currentValue(props);
  return (
    <div className={styles.field}>
      <label className={hideLabel ? styles.srOnly : styles.label} htmlFor={id}>
        {label}
      </label>
      <SelectMenu
        id={id}
        value={value}
        options={options}
        disabled={props.disabled}
        required={props.required}
        name={props.name}
        invalid={error !== undefined}
        describedBy={describedBy}
        onBlur={(event) => {
          props.onBlur?.(event as unknown as FocusEvent<HTMLSelectElement>);
        }}
        onValueChange={(next) => {
          props.onChange?.(changeEvent(next));
        }}
      />
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
}
