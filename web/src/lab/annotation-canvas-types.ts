import type { Ref } from "react";
import type { ImageSize } from "./annotation-coordinates";
import type { AnnotationMark } from "./annotation-state";

export type AnnotationTool = "select" | "box" | "point" | "pan";

export interface AnnotationCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  actualSize: () => void;
  focus: () => void;
}

export interface AnnotationCanvasProps {
  ref?: Ref<AnnotationCanvasHandle>;
  image: ImageSize & { src: string };
  marks: AnnotationMark[];
  onMarksChange?: (marks: AnnotationMark[]) => void;
  tool: AnnotationTool;
  onToolChange?: (tool: AnnotationTool) => void;
  defaultBox: ImageSize;
  markerColor: string;
  showGrid: boolean;
  onZoomChange?: (scale: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSettings?: () => void;
  onToggleGrid?: () => void;
  onHelp?: () => void;
}
