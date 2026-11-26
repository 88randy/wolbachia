import { useTranslation } from "react-i18next";
import styles from "./annotation.module.css";

export function AnnotationDraftStatus({ status }: { status?: string }) {
  const { t } = useTranslation();
  return (
    <p role="status" className={styles.draftStatus}>
      {status && t(status === "saved" ? "labAnnotation.draft.saved" : "labAnnotation.draft.failed")}
    </p>
  );
}
