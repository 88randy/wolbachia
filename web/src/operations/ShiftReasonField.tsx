import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { ShiftDecisionFormState } from "./use-shift-decision";
import styles from "./shifts.module.css";
export function ShiftReasonField({ form }: { form: ShiftDecisionFormState }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{t("shift.field.reason")}</label>
      <textarea
        id={id}
        className={styles.textarea}
        rows={4}
        required
        readOnly={form.isBusy}
        value={form.reason}
        aria-invalid={form.error ? true : undefined}
        aria-describedby={id + "-hint " + id + "-error"}
        onBlur={form.onBlur}
        onChange={(event) => {
          form.setReason(event.currentTarget.value);
        }}
      />
      <p className={styles.hint} id={id + "-hint"}>
        {t("shift.field.reasonHint", { min: form.limits.minLength, max: form.limits.maxLength })}
      </p>
      <p className={styles.error} id={id + "-error"} aria-live="polite">
        {form.error ? t(form.error) : ""}
      </p>
    </div>
  );
}
