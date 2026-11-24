import { useRef, useState } from "react";
import type { AnnotationCanvasHandle, AnnotationTool } from "./EggAnnotationCanvas";
import type { AnnotationColor } from "./AnnotationSettings";
function useAnnotationPreferences() {
  const [defaultBox, setDefaultBox] = useState({ width: 12, height: 24 });
  const [color, setColor] = useState<AnnotationColor>("action");
  return { defaultBox, setDefaultBox, color, setColor };
}
export function useAnnotationWorkspaceView() {
  const canvas = useRef<AnnotationCanvasHandle>(null);
  const [tool, onToolChange] = useState<AnnotationTool>("box");
  const [zoom, onZoomChange] = useState(1);
  const [showGrid, setGrid] = useState(false);
  const [showSettings, setSettings] = useState(false);
  const [showHelp, onHelpChange] = useState(false);
  const preferences = useAnnotationPreferences();
  const onGrid = () => {
    setGrid((value) => !value);
  };
  const onSettings = () => {
    setSettings((value) => !value);
  };
  return {
    ...preferences,
    canvas,
    tool,
    onToolChange,
    zoom,
    onZoomChange,
    showGrid,
    onGrid,
    showSettings,
    onSettings,
    showHelp,
    onHelpChange,
  };
}
export type AnnotationWorkspaceView = ReturnType<typeof useAnnotationWorkspaceView>;
