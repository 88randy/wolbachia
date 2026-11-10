/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { Flag, MapPin, Move, PenLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { cn } from "@/lib/utils";
import type { EditorTool } from "./editor-model";

interface ToolOption {
  tool: EditorTool;
  icon: LucideIcon;
  label: MessageKey;
  hint: MessageKey;
}

const TOOLS: readonly ToolOption[] = [
  {
    tool: "quadrant",
    icon: PenLine,
    label: "mapEditor.tool.quadrant",
    hint: "mapEditor.tool.quadrantHint",
  },
  {
    tool: "sampling",
    icon: MapPin,
    label: "mapEditor.tool.sampling",
    hint: "mapEditor.tool.samplingHint",
  },
  {
    tool: "release",
    icon: Flag,
    label: "mapEditor.tool.release",
    hint: "mapEditor.tool.releaseHint",
  },
  { tool: "move", icon: Move, label: "mapEditor.tool.move", hint: "mapEditor.tool.moveHint" },
];

interface Props {
  active: EditorTool;
  allowed: ReadonlySet<EditorTool>;
  onSelect: (tool: EditorTool) => void;
}

/** The four editor tools: big buttons with an icon, a verb and one line of help. */
export function ToolPicker({ active, allowed, onSelect }: Props) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t("mapEditor.tool.group")} className="flex flex-col gap-2">
      {TOOLS.filter((item) => allowed.has(item.tool)).map((item) => {
        const Icon = item.icon;
        const isActive = active === item.tool;
        return (
          <button
            key={item.tool}
            type="button"
            aria-pressed={isActive}
            onClick={() => {
              onSelect(isActive ? "browse" : item.tool);
            }}
            className={cn(
              "flex min-h-14 w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
              isActive
                ? "border-action bg-action text-on-action"
                : "border-line bg-surface text-ink hover:border-action hover:bg-tint",
            )}
          >
            <Icon aria-hidden="true" className="mt-0.5 size-5 flex-none" />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">{t(item.label)}</span>
              <span className={cn("text-xs", isActive ? "text-on-action" : "text-ink-2")}>
                {t(item.hint)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
