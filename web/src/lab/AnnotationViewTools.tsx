import { useTranslation } from "react-i18next";
import { Scan, Grid2X2 } from "lucide-react";
import { AnnotationIconButton } from "./AnnotationIconButton";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";
import { AnnotationZoomControls } from "./AnnotationZoomControls";
import styles from "./annotation.module.css";

type Props = Pick<AnnotationToolbarProps, "canvas" | "zoom" | "showGrid" | "onGrid">;

export function AnnotationViewTools(props: Props) {
  const { t } = useTranslation();
  return (
    <>
      <AnnotationZoomControls {...props} />
      <AnnotationIconButton
        label={t("labAnnotation.editor.fit")}
        onClick={() => props.canvas.current?.fit()}
      >
        <Scan aria-hidden="true" />
      </AnnotationIconButton>
      <span className={styles.divider} role="separator" aria-orientation="vertical" />
      <AnnotationIconButton
        label={t("labAnnotation.editor.grid")}
        aria-pressed={props.showGrid}
        onClick={props.onGrid}
      >
        <Grid2X2 aria-hidden="true" />
      </AnnotationIconButton>
    </>
  );
}
