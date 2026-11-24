import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Tooltip } from "../ui/Tooltip";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";
import { useAnnotationZoom } from "./use-annotation-format";
import styles from "./annotation.module.css";

export function AnnotationZoomPercent({
  canvas,
  zoom: scale,
}: Pick<AnnotationToolbarProps, "canvas" | "zoom">) {
  const { t } = useTranslation();
  const zoom = useAnnotationZoom(scale);
  return (
    <Tooltip content={t("labAnnotation.editor.fit")}>
      <Button
        variant="ghost"
        size="sm"
        className={styles.zoomButton}
        aria-label={t("labAnnotation.editor.zoom", { percent: zoom })}
        onClick={() => canvas.current?.fit()}
      >
        {zoom}
      </Button>
    </Tooltip>
  );
}
