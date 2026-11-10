import { useTranslation } from "react-i18next";
import type { useCorrectionForm } from "./use-correction-form";
import styles from "./lab.module.css";

interface CorrectionReasonNoteFieldProps {
  id: string;
  form: ReturnType<typeof useCorrectionForm>;
  isLocked: boolean;
}

export function CorrectionReasonNoteField({ id, form, isLocked }: CorrectionReasonNoteFieldProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.field}>
      <label htmlFor={id + "-note"}>{t("lab.correction.reason")}</label>
      <textarea
        id={id + "-note"}
        value={form.reason}
        readOnly={isLocked}
        maxLength={1000}
        aria-invalid={form.hasReasonError || undefined}
        aria-describedby={id + "-help"}
        onChange={(event) => {
          form.setReason(event.target.value);
        }}
      />
      <p id={id + "-help"}>{t("lab.correction.noteHint")}</p>
    </div>
  );
}
