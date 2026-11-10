import type { RefObject } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FieldNotes } from "../forms/FieldNotes";
import styles from "./lab.module.css";
interface CountInputProps {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  onBlur?: () => void;
  isInvalid: boolean;
  isReadOnly?: boolean;
  isReplacement?: boolean;
}
/** Text with a numeric keypad preserves invalid scanner input for an explicit inline error. */
export function CountInput(props: CountInputProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {t(props.isReplacement ? "lab.count.replacement" : "lab.count.howMany")}
      </label>
      <input
        id={id}
        ref={props.inputRef}
        className={styles.countInput}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        onBlur={props.onBlur}
        value={props.value}
        readOnly={props.isReadOnly}
        aria-invalid={props.isInvalid || undefined}
        aria-describedby={props.isInvalid ? id + "-error" : undefined}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
      <FieldNotes id={id} error={props.isInvalid ? t("lab.count.integer") : undefined} />
    </div>
  );
}
