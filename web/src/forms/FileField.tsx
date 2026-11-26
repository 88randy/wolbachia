import type { ChangeEvent } from "react";
import { FieldNotes } from "./FieldNotes";
import { FileChooser } from "./FileChooser";
import styles from "./form.module.css";

interface FileFieldProps {
  id: string;
  label: string;
  /** Value of the `accept` attribute (types or extensions). */
  accept: string;
  /** The file already picked, if any: its name is shown next to the button. */
  file?: File | undefined;
  hint?: string;
  /** Already translated error text of this field. */
  error?: string | undefined;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Label, a button that opens the browser's file chooser and the chosen name. The native input
 * stays in the page (visually hidden) so the label keeps working, and the button's text comes
 * from the catalog instead of the browser's language.
 */
export function FileField({ label, hint, error, ...chooser }: FileFieldProps) {
  const notes = [
    hint !== undefined && `${chooser.id}-hint`,
    error !== undefined && `${chooser.id}-error`,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return (
    <div className={styles.field}>
      <label htmlFor={chooser.id} className={styles.label}>
        {label}
      </label>
      <FileChooser
        {...chooser}
        file={chooser.file}
        disabled={chooser.disabled}
        invalid={error !== undefined}
        describedBy={notes === "" ? undefined : notes}
      />
      <FieldNotes id={chooser.id} hint={hint} error={error} />
    </div>
  );
}
