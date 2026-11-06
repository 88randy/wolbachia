import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "../void/void-dialog.module.css";
import type { UnblockForm } from "./use-unblock-form";
import { UnblockReasonNotes } from "./UnblockReasonNotes";

function useErrorFocus(error: string | undefined) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (error !== undefined) input.current?.focus();
  }, [error]);
  return input;
}

/** A permanent reason field describes the server's limits without moving initial Cancel focus. */
export function UnblockReasonField({ form }: { form: UnblockForm }) {
  const { t } = useTranslation();
  const id = useId();
  const input = useErrorFocus(form.reasonError);
  const error = form.reasonError ? t("voiding.error.tooShort", { min: form.minLength }) : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {t("fleet.unblock.reason")} ({t("voiding.dialog.required")})
      </label>
      <textarea
        ref={input}
        id={id}
        className={styles.textarea}
        value={form.reason}
        rows={4}
        maxLength={form.maxLength}
        required
        readOnly={form.isBusy}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-hint ${id}-counter${error ? ` ${id}-error` : ""}`}
        onChange={(event) => {
          form.setReason(event.target.value);
        }}
      />
      <UnblockReasonNotes id={id} form={form} error={error} />
    </div>
  );
}
