import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { AnnotationSettingsProps } from "./AnnotationSettings";

const COLORS = ["action", "success", "critical"] as const;
type MarkerProps = Pick<AnnotationSettingsProps, "color" | "setColor" | "showGrid" | "onGrid">;

export function AnnotationMarkerSettings(props: MarkerProps) {
  const { t } = useTranslation();
  const id = useId();
  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const color = event.target.value;
    if (color === "action" || color === "success" || color === "critical") props.setColor(color);
  };
  return (
    <>
      <label htmlFor={id}>
        {t("labAnnotation.editor.markerColor")}
        <select id={id} name="marker-color" value={props.color} onChange={onChange}>
          {COLORS.map((color) => (
            <option key={color} value={color}>
              {t(`labAnnotation.color.${color}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={props.showGrid} onChange={props.onGrid} />
        {t("labAnnotation.editor.grid")}
      </label>
    </>
  );
}
