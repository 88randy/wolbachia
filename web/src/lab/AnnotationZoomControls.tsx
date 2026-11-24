import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut } from "lucide-react";
import { AnnotationIconButton } from "./AnnotationIconButton";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";
import { AnnotationZoomPercent } from "./AnnotationZoomPercent";

type Props = Pick<AnnotationToolbarProps, "canvas" | "zoom">;
export function AnnotationZoomControls({ canvas, zoom: scale }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <AnnotationIconButton
        label={t("labAnnotation.editor.zoomOut")}
        shortcut="-"
        onClick={() => canvas.current?.zoomOut()}
      >
        <ZoomOut aria-hidden="true" />
      </AnnotationIconButton>
      <AnnotationZoomPercent canvas={canvas} zoom={scale} />
      <AnnotationIconButton
        label={t("labAnnotation.editor.zoomIn")}
        shortcut="+"
        onClick={() => canvas.current?.zoomIn()}
      >
        <ZoomIn aria-hidden="true" />
      </AnnotationIconButton>
    </>
  );
}
