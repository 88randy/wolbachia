import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "../ui/Tooltip";
import styles from "./annotation.module.css";

export function AnnotationBackLink() {
  const { t } = useTranslation();
  return (
    <span className={styles.wideTools}>
      <Tooltip content={t("labAnnotation.editor.back")}>
        <Link
          className={styles.iconButton}
          to="/lab/egg-counts"
          search={{}}
          aria-label={t("labAnnotation.editor.back")}
        >
          <ArrowLeft aria-hidden="true" />
        </Link>
      </Tooltip>
      <span className={styles.divider} role="separator" aria-orientation="vertical" />
    </span>
  );
}
