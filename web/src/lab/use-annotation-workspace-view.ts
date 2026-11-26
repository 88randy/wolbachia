import { useRef, useState, type RefObject } from "react";
import type { AnnotationCanvasHandle, AnnotationTool } from "./EggAnnotationCanvas";
import { useAnnotationPreferences } from "./use-annotation-preferences";
export function useAnnotationWorkspaceView(userId = "") {
  const canvas = useRef<AnnotationCanvasHandle>(null);
  const dialogs = useAnnotationDialogs();
  const tools = useAnnotationTool(canvas, !dialogs.showSettings);
  const [zoom, onZoomChange] = useState(1);
  const [showGrid, setGrid] = useState(false);
  const preferences = useAnnotationPreferences(userId);
  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    canvas.current?.focus();
  };
  const onGrid = () => {
    setGrid((value) => !value);
    if (!dialogs.showSettings) canvas.current?.focus();
  };
  return {
    ...preferences,
    onCloseAutoFocus,
    canvas,
    ...tools,
    zoom,
    onZoomChange,
    showGrid,
    onGrid,
    ...dialogs,
  };
}
function useAnnotationDialogs() {
  const [showSettings, setSettings] = useState(false);
  const [showHelp, onHelpChange] = useState(false);
  const [showShortcuts, onShortcutsChange] = useState(false);
  return {
    showSettings,
    onSettings: () => {
      setSettings((value) => !value);
    },
    showHelp,
    onHelpChange,
    showShortcuts,
    onShortcutsChange,
    onHelp: () => {
      onShortcutsChange(true);
    },
    onTips: () => {
      onHelpChange(true);
    },
  };
}
function useAnnotationTool(
  canvas: RefObject<AnnotationCanvasHandle | null>,
  shouldFocusCanvas: boolean,
) {
  const [tool, setTool] = useState<AnnotationTool>("box");
  const onToolChange = (next: AnnotationTool) => {
    setTool(next);
    if (shouldFocusCanvas) canvas.current?.focus();
  };
  return { tool, onToolChange };
}
export type AnnotationWorkspaceView = ReturnType<typeof useAnnotationWorkspaceView>;
