/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { Flag, MapPin, MousePointer2, PenLine, Redo2, Scan, Trash2, Undo2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import type { EditorTool } from "./editor-model";
import type { MapEditor } from "./use-map-editor";
import { KEY_DELETE, KEY_FIT, KEY_REDO, KEY_UNDO, TOOL_KEYS } from "./editor-shortcuts";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { ToolbarButton } from "./ToolbarButton";

const TOOLS: readonly {
  tool: EditorTool;
  icon: LucideIcon;
  label: MessageKey;
}[] = [
  {
    tool: "select",
    icon: MousePointer2,
    label: "mapEditor.toolShort.select",
  },
  {
    tool: "quadrant",
    icon: PenLine,
    label: "mapEditor.toolShort.quadrant",
  },
  {
    tool: "sampling",
    icon: MapPin,
    label: "mapEditor.toolShort.sampling",
  },
  {
    tool: "release",
    icon: Flag,
    label: "mapEditor.toolShort.release",
  },
];

interface Props {
  editor: MapEditor;
  allowed: ReadonlySet<EditorTool>;
  isHelpOpen: boolean;
  onHelpChange: (open: boolean) => void;
}

/** Tools on the left, history and view on the right. Every button names its shortcut. */
export function EditorToolbar({ editor, allowed, isHelpOpen, onHelpChange }: Props) {
  const { t } = useTranslation();
  const canRemove = editor.selected !== null && editor.selected.saved === null;
  return (
    <div
      role="toolbar"
      aria-label={t("mapEditor.toolbar.label")}
      className="flex flex-wrap items-center gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-card"
    >
      <div role="group" aria-label={t("mapEditor.tool.group")} className="flex flex-wrap gap-1">
        {TOOLS.filter((item) => allowed.has(item.tool)).map((item) => (
          <ToolbarButton
            key={item.tool}
            icon={item.icon}
            label={t(item.label)}
            shortcut={TOOL_KEYS[item.tool]}
            isActive={editor.tool === item.tool}
            onClick={() => {
              editor.setTool(item.tool);
            }}
          />
        ))}
      </div>
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
      <ToolbarButton
        icon={Undo2}
        label={t("mapEditor.action.undoStep")}
        shortcut={KEY_UNDO}
        isIconOnly
        isDisabled={!editor.canUndo}
        onClick={editor.undo}
      />
      <ToolbarButton
        icon={Redo2}
        label={t("mapEditor.action.redoStep")}
        shortcut={KEY_REDO}
        isIconOnly
        isDisabled={!editor.canRedo}
        onClick={editor.redo}
      />
      <ToolbarButton
        icon={Trash2}
        label={t("mapEditor.action.delete")}
        shortcut={KEY_DELETE}
        isIconOnly
        isDisabled={!canRemove}
        onClick={() => {
          if (editor.selectedKey) editor.removeShape(editor.selectedKey);
        }}
      />
      <span aria-hidden="true" className="mx-1 h-6 w-px bg-line" />
      <ToolbarButton
        icon={Scan}
        label={t("mapEditor.action.fit")}
        shortcut={KEY_FIT}
        isIconOnly
        onClick={() => {
          editor.fit();
        }}
      />
      <div className="ml-auto">
        <ShortcutsHelp isOpen={isHelpOpen} onOpenChange={onHelpChange} />
      </div>
    </div>
  );
}
