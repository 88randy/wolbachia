import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface OverflowAction {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** Shown disabled; give the reason in the label or next to the page header. */
  disabled?: boolean;
  /** Void, revoke and similar: red text. */
  destructive?: boolean;
}

/** The "⋯" menu for rare actions (page header) and for row actions (DataTable). */
export function OverflowMenu({
  actions,
  label,
  size = "md",
}: {
  actions: readonly OverflowAction[];
  /** Accessible name; defaults to "Más opciones". */
  label?: string;
  size?: "sm" | "md";
}) {
  const { t } = useTranslation();
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label ?? t("common.actions.more")}
        className={cn(
          "grid flex-none place-items-center rounded-lg border border-line bg-surface text-ink-2 shadow-xs hover:bg-surface-muted hover:text-ink",
          size === "sm" ? "size-8" : "size-9",
        )}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <Ellipsis aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48 rounded-xl border border-line p-1">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            disabled={action.disabled}
            className={cn(
              "min-h-9 gap-2 rounded-lg text-[13px]",
              action.destructive && "text-critical-fg focus:text-critical-fg",
            )}
            onSelect={action.onSelect}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
