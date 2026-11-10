import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TextFilter } from "./table-types";
import { useDebouncedFilter } from "./use-debounced-filter";
import { FIELD_CLASS } from "./filter-classes";

interface FilterSearchProps {
  filter: TextFilter;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/** The toolbar search box: live with a 300 ms debounce, no "Aplicar" button. */
export function FilterSearch({ filter, value, onChange }: FilterSearchProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useDebouncedFilter(value, onChange);
  return (
    <div role="search" className="relative flex min-w-0 flex-1 basis-56 sm:max-w-sm">
      <Search
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
      />
      <input
        type="search"
        aria-label={t(filter.labelKey)}
        placeholder={t(filter.labelKey)}
        value={draft}
        maxLength={filter.maxLength}
        inputMode={filter.format === "positive-integer" ? "numeric" : undefined}
        autoComplete="off"
        className={`${FIELD_CLASS} w-full pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden`}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
        }}
      />
      {draft !== "" && (
        <button
          type="button"
          aria-label={t("table.filters.clear")}
          className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-muted hover:text-ink"
          onClick={() => {
            setDraft("");
            onChange(undefined);
          }}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}
