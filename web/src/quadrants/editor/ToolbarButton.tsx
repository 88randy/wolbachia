/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "../../ui/Tooltip";

interface Props {
  icon: LucideIcon;
  label: string;
  /** Shown in the tooltip and announced to assistive technology. */
  shortcut?: string;
  onClick: () => void;
  isActive?: boolean;
  isDisabled?: boolean;
  /** Hide the text on narrow toolbars; the tooltip keeps the name. */
  isIconOnly?: boolean;
}

/** One toolbar button: icon, optional label, and a tooltip with the shortcut. */
export function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  onClick,
  isActive,
  isDisabled,
  isIconOnly,
}: Props) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={isActive}
        aria-keyshortcuts={shortcut}
        disabled={isDisabled}
        onClick={onClick}
        className={cn(
          "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-45",
          isActive
            ? "border-action bg-action text-on-action"
            : "border-transparent bg-transparent text-ink hover:bg-tint hover:text-action-strong disabled:hover:bg-transparent",
          isIconOnly && "px-2.5",
        )}
      >
        <Icon aria-hidden="true" className="size-4 flex-none" />
        {!isIconOnly && <span>{label}</span>}
      </button>
    </Tooltip>
  );
}
