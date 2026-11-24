import { useTranslation } from "react-i18next";
import { CardMenu } from "../ui/CardMenu";
import { AnnotationEditActions } from "./AnnotationEditActions";
import { AnnotationViewTools } from "./AnnotationViewTools";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";
import { useAnnotationCompactMenu, useAnnotationDownloadMenu } from "./use-annotation-menu";
import styles from "./annotation.module.css";
export function AnnotationToolbarExtras(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  const compact = useAnnotationCompactMenu(props);
  const downloads = useAnnotationDownloadMenu(props);
  return (
    <>
      <span className={styles.wideTools}>
        <AnnotationViewTools {...props} />
        <AnnotationEditActions {...props} />
        <CardMenu label={t("labAnnotation.editor.actions")} items={downloads} />
      </span>
      <span className={styles.compactTools}>
        <CardMenu label={t("labAnnotation.editor.actions")} items={compact} />
      </span>
    </>
  );
}
