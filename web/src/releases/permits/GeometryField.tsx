import { useId } from "react";
import { classNames } from "../../styles/class-names";
import { FieldNotes } from "../../forms/FieldNotes";
import dialog from "../../void/void-dialog.module.css";

interface Props {
  label: string;
  hint: string;
  value: string;
  error?: string | undefined;
  onChange: (value: string) => void;
}

/** Plain multi-line field for the pasted GeoJSON polygon; the text is data, not copy. */
export function GeometryField({ label, hint, value, error, onChange }: Props) {
  const id = useId();
  return (
    <div className={dialog.field}>
      <label htmlFor={id} className={dialog.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={classNames(dialog.textarea, error !== undefined && dialog.invalid)}
        value={value}
        spellCheck={false}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? `${id}-hint` : `${id}-error`}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      />
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
}
