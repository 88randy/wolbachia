import { useAnnotationViewerControls } from "./use-annotation-viewer-controls";
import type { Schemas } from "@wolbachia/api-client";
import { EggAnnotationCanvas } from "./EggAnnotationCanvas";
import { AnnotationViewTools } from "./AnnotationViewTools";
import styles from "./annotation.module.css";
export function AnnotationViewerSurface({
  annotation,
  url,
}: {
  annotation: Schemas["EggAnnotation"];
  url: string;
}) {
  const controls = useAnnotationViewerControls();
  const image = { src: url, width: annotation.image_width, height: annotation.image_height };
  return (
    <div className={styles.viewer}>
      <div className={styles.toolbar}>
        <AnnotationViewTools {...controls} />
      </div>
      <EggAnnotationCanvas
        ref={controls.canvas}
        image={image}
        marks={annotation.marks}
        tool="pan"
        defaultBox={{ width: 1, height: 1 }}
        markerColor="var(--color-action)"
        showGrid={controls.showGrid}
        onZoomChange={controls.onZoomChange}
        onToggleGrid={controls.onGrid}
      />
    </div>
  );
}
