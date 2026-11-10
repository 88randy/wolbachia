import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TOOL_BUTTON_CLASS } from "./filter-classes";

interface FilterPopoverProps {
  /** Number of active filters inside the popover, shown on the button. */
  activeCount: number;
  children: ReactNode;
}

/** The "Filtros" button and its panel. Every control inside applies at once. */
export function FilterPopover({ activeCount, children }: FilterPopoverProps) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger className={TOOL_BUTTON_CLASS}>
        <SlidersHorizontal aria-hidden="true" strokeWidth={1.75} className="size-4" />
        {t("table.filters.button")}
        {activeCount > 0 && (
          <span className="rounded-full bg-action px-1.5 text-xs leading-5 font-bold text-on-action tabular-nums">
            {activeCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[min(36rem,calc(100dvh-8rem))] w-[min(22rem,calc(100vw-2rem))] flex-col gap-4 overflow-y-auto rounded-xl border border-line bg-popover p-4 shadow-overlay"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
