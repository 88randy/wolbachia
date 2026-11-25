import { useTranslation } from "react-i18next";
import type { AnnotationSettingsProps } from "./AnnotationSettings";
import { AnnotationSizeSlider } from "./AnnotationSizeSlider";
import { MAX_DEFAULT_BOX_SIZE } from "./annotation-preferences";

const BOX_AXES = ["width", "height"] as const;
type BoxProps = Pick<AnnotationSettingsProps, "defaultBox" | "setDefaultBox" | "width" | "height">;

export function AnnotationBoxSettings(props: BoxProps) {
  const { t } = useTranslation();
  const labels = {
    width: t("labAnnotation.editor.defaultWidth"),
    height: t("labAnnotation.editor.defaultHeight"),
  };
  return (
    <>
      {BOX_AXES.map((axis) => (
        <AnnotationSizeSlider
          key={axis}
          label={labels[axis]}
          min={1}
          max={Math.min(props[axis], MAX_DEFAULT_BOX_SIZE)}
          value={Math.min(props.defaultBox[axis], props[axis])}
          onChange={(value) => {
            props.setDefaultBox({ ...props.defaultBox, [axis]: value });
          }}
        />
      ))}
    </>
  );
}
