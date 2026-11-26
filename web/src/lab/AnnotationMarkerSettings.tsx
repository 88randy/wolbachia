import { Switch } from "../ui/Switch";
import { useTranslation } from "react-i18next";
import type { AnnotationSettingsProps } from "./AnnotationSettings";
import { AnnotationColorSwatches } from "./AnnotationColorSwatches";
import { AnnotationSizeSlider } from "./AnnotationSizeSlider";
import {
  ANNOTATION_GRID_STEP,
  MIN_ANNOTATION_GRID_SIZE,
  MAX_ANNOTATION_GRID_SIZE,
} from "./annotation-preferences";
import styles from "./annotation-settings.module.css";

type MarkerProps = Pick<
  AnnotationSettingsProps,
  "color" | "setColor" | "showGrid" | "onGrid" | "gridSize" | "setGridSize"
>;
export function AnnotationMarkerSettings(props: MarkerProps) {
  const { t } = useTranslation();
  return (
    <>
      <AnnotationColorSwatches color={props.color} setColor={props.setColor} />
      <div className={styles.gridSwitch}>
        <Switch
          label={t("labAnnotation.editor.gridLabel")}
          isOn={props.showGrid}
          onChange={props.onGrid}
        />
      </div>
      {props.showGrid && (
        <AnnotationSizeSlider
          label={t("labAnnotation.editor.gridSize")}
          min={MIN_ANNOTATION_GRID_SIZE}
          max={MAX_ANNOTATION_GRID_SIZE}
          step={ANNOTATION_GRID_STEP}
          value={props.gridSize}
          onChange={props.setGridSize}
        />
      )}
    </>
  );
}
