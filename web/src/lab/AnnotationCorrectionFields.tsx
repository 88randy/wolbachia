import { useId } from "react";
import { useTranslation } from "react-i18next";
import { AnnotationCorrectionCodeField } from "./AnnotationCorrectionCodeField";
import { AnnotationCorrectionNoteField } from "./AnnotationCorrectionNoteField";
import type { useLabText } from "./use-lab-text";
import styles from "./annotation.module.css";
export interface AnnotationCorrectionFieldProps {
  reason: ReturnType<typeof useLabText>;
  code: ReturnType<typeof useLabText>;
  isLocked: boolean;
  isInvalid: boolean;
}
export function AnnotationCorrectionFields(props: AnnotationCorrectionFieldProps) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <section className={styles.settings} aria-label={t("lab.correction.title")}>
      <h2>{t("lab.correction.title")}</h2>
      <AnnotationCorrectionCodeField {...props} id={id} />
      <AnnotationCorrectionNoteField {...props} id={id} />
    </section>
  );
}
