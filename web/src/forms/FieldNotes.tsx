import styles from "./form.module.css";

interface FieldNotesProps {
  /** Id of the field; the notes get `<id>-hint` and `<id>-error`. */
  id: string;
  hint?: string | undefined;
  error?: string | undefined;
}

/** The hint and the error under a field. Their ids are what the input's `aria-describedby` names. */
export function FieldNotes({ id, hint, error }: FieldNotesProps) {
  return (
    <>
      {hint !== undefined && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}
