import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FieldNotes } from "../../forms/FieldNotes";
import { classNames } from "../../styles/class-names";
import dialog from "../../void/void-dialog.module.css";
import { SUSPEND_REASON_MIN } from "./use-suspend-permit";

interface Props {
  value: string;
  hasError: boolean;
  isBusy: boolean;
  onChange: (value: string) => void;
}

/** Required written reason: it stays in the history, so it is never optional. */
export function SuspendReasonField({ value, hasError, isBusy, onChange }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const min = SUSPEND_REASON_MIN;
  return (
    <div className={dialog.field}>
      <label htmlFor={id} className={dialog.label}>
        {t("permits.suspend.reason")}
      </label>
      <textarea
        id={id}
        className={classNames(dialog.textarea, hasError && dialog.invalid)}
        value={value}
        maxLength={1000}
        required
        disabled={isBusy}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={hasError ? `${id}-error` : `${id}-hint`}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      />
      <FieldNotes
        id={id}
        hint={t("permits.suspend.reasonHint", { min })}
        error={hasError ? t("permits.suspend.reasonTooShort", { min }) : undefined}
      />
    </div>
  );
}
