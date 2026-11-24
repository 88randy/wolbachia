import { useTranslation } from "react-i18next";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";
export function useAnnotationDownloadMenu(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  return [
    { label: t("labAnnotation.editor.downloadMarks"), onSelect: props.onDownloadMarks },
    { label: t("labAnnotation.editor.downloadImage"), onSelect: props.onDownloadImage },
  ];
}
function useAnnotationZoomMenu(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  return [
    {
      label: t("labAnnotation.editor.zoomOut"),
      onSelect: () => {
        props.canvas.current?.zoomOut();
      },
    },
    {
      label: t("labAnnotation.editor.zoom", { percent: Math.round(props.zoom * 100) }),
      onSelect: () => {
        props.canvas.current?.focus();
      },
      disabled: true,
    },
    {
      label: t("labAnnotation.editor.zoomIn"),
      onSelect: () => {
        props.canvas.current?.zoomIn();
      },
    },
  ];
}
function useAnnotationViewMenu(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  const zoom = useAnnotationZoomMenu(props);
  return [
    ...zoom,
    {
      label: t("labAnnotation.editor.fit"),
      onSelect: () => {
        props.canvas.current?.fit();
      },
    },
    {
      label: t("labAnnotation.editor.actualSize"),
      onSelect: () => {
        props.canvas.current?.actualSize();
      },
    },
    {
      label: t(props.showGrid ? "labAnnotation.editor.gridOn" : "labAnnotation.editor.gridOff"),
      onSelect: props.onGrid,
    },
  ];
}
export function useAnnotationCompactMenu(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  const view = useAnnotationViewMenu(props);
  const downloads = useAnnotationDownloadMenu(props);
  return [
    ...view,
    {
      label: t("labAnnotation.editor.undo"),
      onSelect: props.onUndo,
      disabled: props.isLocked || !props.canUndo,
    },
    {
      label: t("labAnnotation.editor.redo"),
      onSelect: props.onRedo,
      disabled: props.isLocked || !props.canRedo,
    },
    { label: t("labAnnotation.editor.settings"), onSelect: props.onSettings },
    ...downloads,
  ];
}
