import { useEffect, useId, useRef } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { VoidReasonOptions } from "./VoidReasonOptions";
import { FieldNotes } from "../forms/FieldNotes";
import type { VoidForm } from "./use-void-form";
import styles from "./void-dialog.module.css";

/** Native, explicitly labelled picker. The API supplies the active items in display order. */
export function VoidReasonSelect({ form }: { form: VoidForm }) {
  const { t } = useTranslation();
  const id = useId();
  const input = useSelectFocus(form);
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {t("voiding.dialog.reasonLabel")}
      </label>
      <select
        {...input}
        id={id}
        className={styles.select}
        value={form.reasonCode}
        required
        disabled={form.isCatalogBlocked}
        aria-disabled={form.isBusy || form.isCatalogBlocked}
        aria-invalid={form.hasSelectionError || undefined}
        aria-describedby={form.hasSelectionError ? `${id}-error` : undefined}
      >
        <VoidReasonOptions items={form.items} isLoading={form.isCatalogLoading} />
      </select>
      <FieldNotes
        id={id}
        error={form.hasSelectionError ? t("voiding.error.chooseReason") : undefined}
      />
    </div>
  );
}

function useSelectFocus(form: VoidForm) {
  const input = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (!form.isCatalogBlocked) input.current?.focus();
  }, [form.isCatalogBlocked, form.hasSelectionError]);
  return {
    ref: input,
    onChange: (event: ChangeEvent<HTMLSelectElement>) => {
      form.chooseReason(event.target.value);
    },
  };
}
