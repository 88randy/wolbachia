/* eslint-disable max-lines-per-function, complexity, max-depth -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useEffect, useRef } from "react";
import type { EditorTool } from "./editor-model";
import type { MapEditor } from "./use-map-editor";

interface Options {
  editor: MapEditor;
  allowed: ReadonlySet<EditorTool>;
  onSave: () => void;
  onHelp: () => void;
  /** A save is in flight: only the view shortcuts keep working. */
  isBusy: boolean;
}

const TOOL_BY_KEY: Readonly<Record<string, EditorTool>> = {
  v: "select",
  p: "quadrant",
  b: "block",
  m: "sampling",
  r: "release",
};

/** Text fields, lists and dialogs keep their own keys. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest(
      "input, textarea, select, [role='combobox'], [role='listbox'], [role='menu']",
    ) !== null ||
    target.closest("[role='dialog']") !== null
  );
}

/** Editor shortcuts on the whole page; ignored while the focus is in a text input. */
export function useEditorShortcuts(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { editor, allowed, onSave, onHelp, isBusy } = latest.current;
      const key = event.key.toLowerCase();
      const isCommand = event.ctrlKey || event.metaKey;
      if (isCommand && key === "s") {
        event.preventDefault();
        onSave();
        return;
      }
      if (isTyping(event.target) || event.altKey) return;
      if (isBusy && key !== "l" && key !== "f" && event.key !== "?") return;
      if (isCommand) {
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) editor.redo();
          else editor.undo();
        } else if (key === "y") {
          event.preventDefault();
          editor.redo();
        }
        return;
      }
      const tool = TOOL_BY_KEY[key];
      if (tool && allowed.has(tool)) {
        editor.setTool(tool);
        return;
      }
      if (key === "f") editor.fit();
      else if (key === "l") editor.toggleMeasures();
      else if (event.key === "?") {
        // The page help replaces the global one while the editor is open.
        event.stopImmediatePropagation();
        event.preventDefault();
        onHelp();
      } else if (key === "delete" || key === "backspace") {
        if (editor.selectedKey) {
          event.preventDefault();
          editor.removeShape(editor.selectedKey);
        }
      } else if (key === "escape") {
        if (editor.vertexCount > 0) editor.cancelDrawing();
        else if (editor.tool !== "select") editor.setTool("select");
      } else if (key === "enter" && (editor.tool === "quadrant" || editor.tool === "block")) {
        if (document.activeElement !== editor.mapRef.current?.getCanvas()) editor.finishDrawing();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
}
