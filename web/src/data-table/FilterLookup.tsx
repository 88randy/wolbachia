import { Check, Search } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { LookupSource } from "../lookups/lookup-sources";
import { FIELD_CLASS } from "./filter-classes";
import type { TextFilter } from "./table-types";
import { useDebouncedFilter } from "./use-debounced-filter";
import { useLookupOptions } from "./use-lookup-options";

interface FilterLookupProps {
  filter: TextFilter & { lookup: LookupSource };
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}

/** A searchable picker (center, supply, location, person): names on screen, the id in the URL. */
export function FilterLookup({ filter, value, onChange }: FilterLookupProps) {
  const { t } = useTranslation();
  const id = useId();
  const [term, setTerm] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useDebouncedFilter(term, setTerm);
  const query = useLookupOptions(filter.lookup, term ?? "");
  const options = query.data ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-ink">
        {t(filter.labelKey)}
      </label>
      <span className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
        />
        <input
          id={id}
          type="search"
          value={draft}
          placeholder={t("table.filters.searchPlaceholder")}
          autoComplete="off"
          className={`${FIELD_CLASS} w-full pr-3 pl-9`}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
          }}
        />
      </span>
      <ul
        aria-label={t(filter.labelKey)}
        className="m-0 flex max-h-40 list-none flex-col overflow-y-auto rounded-lg border border-line p-1"
      >
        {options.map((option) => {
          const isOn = option.value === value;
          return (
            <li key={option.value}>
              <button
                type="button"
                aria-pressed={isOn}
                className={cn(
                  "flex min-h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[13px] hover:bg-surface-muted",
                  isOn && "bg-tint font-semibold text-action-strong",
                )}
                onClick={() => {
                  onChange(isOn ? undefined : option.value);
                }}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {isOn && <Check aria-hidden="true" className="size-4 flex-none" />}
              </button>
            </li>
          );
        })}
        {options.length === 0 && !query.isFetching && (
          <li className="px-2 py-1.5 text-[13px] text-ink-3">{t("table.empty.filteredTitle")}</li>
        )}
      </ul>
    </div>
  );
}
