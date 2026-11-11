import type { MessageKey } from "@wolbachia/i18n";
import type { EditorTool } from "./editor-model";

export const TOOL_KEYS: Readonly<Record<EditorTool, string>> = {
  select: "V",
  quadrant: "P",
  block: "B",
  sampling: "M",
  release: "R",
};

export const KEY_UNDO = "Ctrl+Z";
export const KEY_REDO = "Ctrl+Shift+Z";
export const KEY_SAVE = "Ctrl+S";
export const KEY_DELETE = "Supr";
export const KEY_FIT = "F";
export const KEY_MEASURES = "L";

/** Rows of the "Atajos" popover: the keys and what they do. */
export const SHORTCUT_ROWS: readonly { keys: string; label: MessageKey }[] = [
  { keys: TOOL_KEYS.select, label: "mapEditor.keys.select" },
  { keys: TOOL_KEYS.quadrant, label: "mapEditor.keys.quadrant" },
  { keys: TOOL_KEYS.block, label: "mapEditor.keys.block" },
  { keys: TOOL_KEYS.sampling, label: "mapEditor.keys.sampling" },
  { keys: TOOL_KEYS.release, label: "mapEditor.keys.release" },
  { keys: "Enter", label: "mapEditor.keys.finish" },
  { keys: "Esc", label: "mapEditor.keys.cancel" },
  { keys: KEY_DELETE, label: "mapEditor.keys.delete" },
  { keys: KEY_UNDO, label: "mapEditor.keys.undo" },
  { keys: `${KEY_REDO} / Ctrl+Y`, label: "mapEditor.keys.redo" },
  { keys: KEY_SAVE, label: "mapEditor.keys.save" },
  { keys: KEY_FIT, label: "mapEditor.keys.fit" },
  { keys: KEY_MEASURES, label: "mapEditor.keys.measures" },
  { keys: "?", label: "mapEditor.keys.help" },
];
