import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FilterChipProps {
  /** Already translated filter name. */
  name: string;
  /** Already translated value. */
  value: string;
  /** Omit for a chip that cannot be removed (the API default of a filter). */
  onRemove?: () => void;
}

/** One active filter as a small chip; removable ones are buttons "Quitar filtro <name>: <value>". */
export function FilterChip({ name, value, onRemove }: FilterChipProps) {
  const { t } = useTranslation();
  const body = (
    <>
      <span className={value ? "text-ink-2" : "font-semibold text-ink"}>
        {value ? `${name}:` : name}
      </span>
      {value && <span className="font-semibold text-ink">{value}</span>}
    </>
  );
  if (!onRemove)
    return (
      <span className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-2.5 text-xs">
        {body}
      </span>
    );
  return (
    <button
      type="button"
      className="inline-flex h-7 items-center gap-1 rounded-full border border-action/30 bg-tint pr-1.5 pl-2.5 text-xs transition-colors hover:border-action"
      aria-label={t("table.filters.remove", { filter: name, value })}
      onClick={onRemove}
    >
      {body}
      <X className="size-3.5 text-action-strong" aria-hidden="true" />
    </button>
  );
}
