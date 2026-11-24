import { useRef, useState } from "react";
import type { AnnotationCanvasHandle } from "./EggAnnotationCanvas";
export function useAnnotationViewerControls() {
  const canvas = useRef<AnnotationCanvasHandle>(null);
  const [zoom, onZoomChange] = useState(1);
  const [showGrid, setGrid] = useState(false);
  const onGrid = () => {
    setGrid((value) => !value);
  };
  return { canvas, zoom, onZoomChange, showGrid, onGrid };
}
