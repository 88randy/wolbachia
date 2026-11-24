import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import styles from "./annotation.module.css";
export function AnnotationWorkspaceHeader({ code }: { code: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.title}>
      <h1>
        {t("labAnnotation.editor.title")}
        {" ? "}
        {code}
      </h1>
      <Link to="/lab/egg-counts" search={{}}>
        {t("labAnnotation.editor.back")}
      </Link>
    </div>
  );
}
