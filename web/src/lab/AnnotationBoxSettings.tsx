import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { AnnotationSettingsProps } from "./AnnotationSettings";

const BOX_AXES = ["width", "height"] as const;
const MAX_DEFAULT_BOX_SIZE = 200;
type BoxProps = Pick<AnnotationSettingsProps, "defaultBox" | "setDefaultBox" | "width" | "height">;

export function AnnotationBoxSettings(props: BoxProps) {
  const { t } = useTranslation();
  const id = useId();
  const labels = {
    width: t("labAnnotation.editor.defaultWidth"),
    height: t("labAnnotation.editor.defaultHeight"),
  };
  return (
    <>
      {BOX_AXES.map((axis) => (
        <label key={axis} htmlFor={id + axis}>
          {labels[axis]}
          <output>{props.defaultBox[axis]}</output>
          <input
            id={id + axis}
            name={"box-" + axis}
            type="range"
            min={1}
            max={Math.min(props[axis], MAX_DEFAULT_BOX_SIZE)}
            value={props.defaultBox[axis]}
            onChange={(event) => {
              props.setDefaultBox({ ...props.defaultBox, [axis]: Number(event.target.value) });
            }}
          />
        </label>
      ))}
    </>
  );
}
