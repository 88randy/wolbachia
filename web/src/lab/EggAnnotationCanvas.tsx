import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { AnnotationCanvasProps } from "./annotation-canvas-types";
import { EggAnnotationSurface } from "./EggAnnotationSurface";
import { useAnnotationCanvas } from "./use-annotation-canvas";
import styles from "./annotation-canvas.module.css";

export type {
  AnnotationCanvasHandle,
  AnnotationCanvasProps,
  AnnotationTool,
} from "./annotation-canvas-types";

/** Accessible, controlled Canvas2D editor; omitted onMarksChange gives a read-only viewer. */
export function EggAnnotationCanvas(props: AnnotationCanvasProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const control = useAnnotationCanvas(props);
  const mark = props.marks[control.selected];
  const selectedText = mark
    ? t("labAnnotation.canvas.selected", {
        index: control.selected + 1,
        count: props.marks.length,
        kind: t(`labAnnotation.editor.${mark.kind}`),
        x: mark.x,
        y: mark.y,
      })
    : t("labAnnotation.canvas.empty");
  return (
    <div className={styles.frame} role="application" aria-label={t("labAnnotation.canvas.label")}>
      <EggAnnotationSurface control={control} hintId={hintId} tool={props.tool} />
      <p id={hintId} className={styles.instructions}>
        {t("labAnnotation.canvas.instructions")}
      </p>
      <p className={styles.selection} aria-live="polite" aria-atomic="true">
        {selectedText}
      </p>
    </div>
  );
}
