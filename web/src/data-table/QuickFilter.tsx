import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SelectFilter } from "./table-types";

interface QuickFilterProps {
  filter: SelectFilter;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** Optional count per option value ("" = all), shown next to each label. */
  counts?: Readonly<Record<string, number>>;
  className?: string;
}

/** Status quick filter: one compact segmented control ("Todos · Preparada · En tránsito…"). */
export function QuickFilter({ filter, value, onChange, counts, className }: QuickFilterProps) {
  const { t } = useTranslation();
  const current = value ?? filter.defaultValue ?? "";
  // With an API default, "Todos" would silently fall back to the default: offer the real options.
  const options =
    filter.defaultValue === undefined
      ? [{ value: "", labelKey: "table.filters.all" } as const, ...filter.options]
      : filter.options;
  return (
    <div
      role="group"
      aria-label={t(filter.labelKey)}
      className={cn(
        "inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const isOn = current === option.value;
        const count = counts?.[option.value];
        return (
          <button
            key={option.value || "all"}
            type="button"
            aria-pressed={isOn}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap text-ink-2 transition-colors hover:text-ink",
              isOn && "bg-surface font-semibold text-ink shadow-xs",
            )}
            onClick={() => {
              onChange(option.value === "" ? undefined : option.value);
            }}
          >
            {t(option.labelKey)}
            {count !== undefined && (
              <span className="rounded-full bg-tint px-1.5 text-xs font-semibold text-action-strong tabular-nums">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
