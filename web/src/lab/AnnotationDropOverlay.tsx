import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import styles from "./annotation-upload.module.css";

export function AnnotationDropOverlay({ isDragging }: { isDragging: boolean }) {
  const { t } = useTranslation();
  if (!isDragging) return null;
  return createPortal(
    <p className={styles.dropOverlay} role="status">
      {t("labAnnotation.upload.dropHere")}
    </p>,
    document.body,
  );
}
