import type { ComponentPropsWithRef, ReactNode } from "react";
import { FieldNotes } from "./FieldNotes";
import styles from "./form.module.css";

interface TextFieldProps extends Omit<ComponentPropsWithRef<"input">, "id" | "className"> {
  id: string;
  label: string;
  /** Already translated error text of this field. */
  error?: string | undefined;
  hint?: string;
  /** Control shown inside the field after the input (e.g. the show-password toggle). */
  trailing?: ReactNode;
}

function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const present = ids.filter((id): id is string => typeof id === "string" && id !== "");
  return present.length > 0 ? present.join(" ") : undefined;
}

/** Label, input, optional hint and error. Presentational: the caller owns the form state. */
export function TextField({ id, label, error, hint, trailing, ...input }: TextFieldProps) {
  const isInvalid = error !== undefined || input["aria-invalid"] === true;
  const notes = describedBy(
    hint !== undefined && `${id}-hint`,
    error !== undefined && `${id}-error`,
    input["aria-describedby"],
  );
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control} data-invalid={isInvalid ? "" : undefined}>
        <input
          {...input}
          id={id}
          className={styles.input}
          aria-invalid={isInvalid ? true : undefined}
          aria-describedby={notes}
        />
        {trailing}
      </div>
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
}
