import { useTranslation } from "react-i18next";
import type { AnnotationSettingsProps } from "./AnnotationSettings";
import { AnnotationSizeSlider } from "./AnnotationSizeSlider";
import { MAX_DEFAULT_BOX_SIZE } from "./annotation-preferences";
import styles from "./annotation-settings.module.css";

const BOX_AXES = [
  {
    axis: "width",
    label: "labAnnotation.editor.defaultWidth",
    ariaLabel: "labAnnotation.editor.defaultWidthLabel",
  },
  {
    axis: "height",
    label: "labAnnotation.editor.defaultHeight",
    ariaLabel: "labAnnotation.editor.defaultHeightLabel",
  },
] as const;
type BoxProps = Pick<AnnotationSettingsProps, "defaultBox" | "setDefaultBox" | "width" | "height">;

export function AnnotationBoxSettings(props: BoxProps) {
  const { t } = useTranslation();
  return (
    <fieldset className={styles.boxSettings}>
      <legend>{t("labAnnotation.editor.singleClickBox")}</legend>
      <p className={styles.hint}>{t("labAnnotation.editor.singleClickBoxHint")}</p>
      {BOX_AXES.map(({ axis, label, ariaLabel }) => (
        <AnnotationSizeSlider
          key={axis}
          label={t(label)}
          ariaLabel={t(ariaLabel)}
          min={1}
          max={Math.min(props[axis], MAX_DEFAULT_BOX_SIZE)}
          value={Math.min(props.defaultBox[axis], props[axis])}
          onChange={(value) => {
            props.setDefaultBox({ ...props.defaultBox, [axis]: value });
          }}
        />
      ))}
    </fieldset>
  );
}
