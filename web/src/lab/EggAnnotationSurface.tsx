import { useTranslation } from "react-i18next";
import type { AnnotationTool } from "./annotation-canvas-types";
import { annotationCanvasEvents, type AnnotationCanvasControl } from "./use-annotation-canvas";
import styles from "./annotation-canvas.module.css";

interface SurfaceProps {
  control: AnnotationCanvasControl;
  hintId: string;
  tool: AnnotationTool;
}

export function EggAnnotationSurface({ control, hintId, tool }: SurfaceProps) {
  const { t } = useTranslation();
  const { surface, keyboard } = control;
  return (
    <div
      ref={surface.containerRef}
      className={styles.surface}
      data-tool={keyboard.isSpaceHeld ? "pan" : tool}
    >
      <canvas ref={surface.backgroundRef} className={styles.layer} aria-hidden="true" />
      <canvas
        ref={surface.canvasRef}
        className={styles.canvas}
        tabIndex={0}
        aria-label={t("labAnnotation.canvas.label")}
        aria-describedby={hintId}
        {...annotationCanvasEvents(control)}
      />
      {!surface.image && (
        <p className={styles.status} role="status">
          {t(surface.hasError ? "labAnnotation.canvas.imageError" : "labAnnotation.canvas.loading")}
        </p>
      )}
    </div>
  );
}
