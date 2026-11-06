import { useTranslation } from "react-i18next";
import { FieldNotes } from "../forms/FieldNotes";
import styles from "../void/void-dialog.module.css";
import type { UnblockForm } from "./use-unblock-form";

interface Props {
  id: string;
  form: UnblockForm;
  error: string | undefined;
}

/** Limit notes describe the field without announcing every keystroke. */
export function UnblockReasonNotes({ id, form, error }: Props) {
  const { t } = useTranslation();
  const counterKey =
    form.count < form.minLength ? "voiding.dialog.counterBelow" : "voiding.dialog.counterOk";
  return (
    <>
      <FieldNotes
        id={id}
        hint={t("voiding.dialog.minHelp", { min: form.minLength })}
        error={error}
      />
      <p id={`${id}-counter`} className={styles.counter}>
        {t(counterKey, { count: form.count, min: form.minLength, max: form.maxLength })}
      </p>
    </>
  );
}
