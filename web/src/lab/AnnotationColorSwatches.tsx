import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { AnnotationSettingsProps } from "./AnnotationSettings";
import { AnnotationColorSwatch } from "./AnnotationColorSwatch";
import styles from "./annotation-settings.module.css";

const COLORS = ["action", "success", "critical", "warning", "neutral"] as const;
export function AnnotationColorSwatches(
  props: Pick<AnnotationSettingsProps, "color" | "setColor">,
) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.colors}>
      <span id={id}>{t("labAnnotation.editor.markerColor")}</span>
      <div role="radiogroup" aria-labelledby={id} className={styles.swatches}>
        {COLORS.map((color) => (
          <AnnotationColorSwatch
            key={color}
            color={color}
            selected={props.color}
            name={id}
            onChange={props.setColor}
          />
        ))}
      </div>
    </div>
  );
}
