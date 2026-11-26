import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FIELD_CLASS } from "./filter-classes";
import type { TextFilter } from "./table-types";
import { useDebouncedFilter } from "./use-debounced-filter";

interface FilterPanelTextProps {
  filter: TextFilter;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/** A secondary text filter inside "Filtros": live, debounced, no "Aplicar". */
export function FilterPanelText({ filter, value, onChange }: FilterPanelTextProps) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useDebouncedFilter(value, onChange);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-ink">
        {t(filter.labelKey)}
      </label>
      <input
        id={id}
        type="search"
        value={draft}
        maxLength={filter.maxLength}
        inputMode={filter.format === "positive-integer" ? "numeric" : undefined}
        autoComplete="off"
        className={`${FIELD_CLASS} w-full px-3`}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
        }}
      />
    </div>
  );
}
