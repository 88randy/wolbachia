import { useId } from "react";
import { useTranslation } from "react-i18next";
import { SelectMenu } from "../ui/SelectMenu";
import { Switch } from "../ui/Switch";
import type { AnnotationSettingsProps } from "./AnnotationSettings";

const COLORS = ["action", "success", "critical"] as const;
type MarkerProps = Pick<AnnotationSettingsProps, "color" | "setColor" | "showGrid" | "onGrid">;

export function AnnotationMarkerSettings(props: MarkerProps) {
  const { t } = useTranslation();
  const id = useId();
  const onChange = (color: string) => {
    if (color === "action" || color === "success" || color === "critical") props.setColor(color);
  };
  return (
    <>
      <div className="grid gap-2">
        <label htmlFor={id}>{t("labAnnotation.editor.markerColor")}</label>
        <SelectMenu
          id={id}
          name="marker-color"
          value={props.color}
          onValueChange={onChange}
          options={COLORS.map((color) => ({
            value: color,
            label: t(`labAnnotation.color.${color}`),
          }))}
        />
      </div>
      <Switch
        label={t("labAnnotation.editor.grid")}
        isOn={props.showGrid}
        onChange={props.onGrid}
      />
    </>
  );
}
