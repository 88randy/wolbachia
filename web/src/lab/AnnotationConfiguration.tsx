import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { AnnotationBoxSettings } from "./AnnotationBoxSettings";
import { AnnotationMarkerSettings } from "./AnnotationMarkerSettings";
import type { AnnotationSettingsProps } from "./AnnotationSettings";
import styles from "./annotation-settings.module.css";

export function AnnotationConfiguration(props: AnnotationSettingsProps) {
  const { t } = useTranslation();
  return (
    <section className={styles.configuration} aria-label={t("labAnnotation.editor.configuration")}>
      <h3>{t("labAnnotation.editor.configuration")}</h3>
      <div className={styles.row}>
        <span>{t("labAnnotation.editor.tool")}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            props.onToolChange(props.tool === "box" ? "point" : "box");
          }}
        >
          {t(
            props.tool === "box"
              ? "labAnnotation.editor.switchToPoint"
              : "labAnnotation.editor.switchToBox",
          )}
        </Button>
      </div>
      <AnnotationBoxSettings {...props} />
      <AnnotationMarkerSettings {...props} />
    </section>
  );
}
