import { useTranslation } from "react-i18next";
import styles from "./annotation.module.css";
export function AnnotationWorkspaceHeader({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.title}>
      <h1>{t("labAnnotation.editor.heading", { code })}</h1>
    </div>
  );
}
