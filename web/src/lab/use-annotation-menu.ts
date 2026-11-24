import { useTranslation } from "react-i18next";
import { useRef } from "react";
import type { AnnotationToolbarProps } from "./AnnotationToolbar";
import { useAnnotationZoom } from "./use-annotation-format";
export function useAnnotationDownloadMenu(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  return [
    { label: t("labAnnotation.editor.downloadMarks"), onSelect: props.onDownloadMarks },
    { label: t("labAnnotation.editor.downloadImage"), onSelect: props.onDownloadImage },
  ];
}
function useAnnotationZoomMenu(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  const zoom = useAnnotationZoom(props.zoom);
  return [
    {
      label: t("labAnnotation.editor.zoomOut"),
      onSelect: () => {
        props.canvas.current?.zoomOut();
      },
    },
    {
      label: t("labAnnotation.editor.zoom", { percent: zoom }),
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
function useAnnotationCompactView(props: AnnotationToolbarProps) {
  const view = useAnnotationViewMenu(props);
  const shouldFocusCanvas = useRef(false);
  const onCloseAutoFocus = (event: Event) => {
    if (!shouldFocusCanvas.current) return;
    shouldFocusCanvas.current = false;
    event.preventDefault();
    props.canvas.current?.focus();
  };
  const items = view.map((item) => ({
    ...item,
    onSelect: () => {
      shouldFocusCanvas.current = true;
      item.onSelect();
    },
  }));
  return { items, onCloseAutoFocus };
}
export function useAnnotationCompactMenu(props: AnnotationToolbarProps) {
  const { t } = useTranslation();
  const view = useAnnotationCompactView(props);
  const downloads = useAnnotationDownloadMenu(props);
  const items = [
    ...view.items,
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
  return { items, onCloseAutoFocus: view.onCloseAutoFocus };
}
