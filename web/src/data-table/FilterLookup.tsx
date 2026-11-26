import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LookupSource } from "../lookups/lookup-sources";
import { Combobox } from "../ui/Combobox";
import type { TextFilter } from "./table-types";
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
  const [search, setSearch] = useState("");
  const query = useLookupOptions(filter.lookup, search);
  const options = [{ value: "", label: t("table.filters.all") }, ...(query.data ?? [])];
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-ink">
        {t(filter.labelKey)}
      </label>
      <Combobox
        id={id}
        value={value ?? ""}
        options={options}
        placeholder={t("table.filters.all")}
        isLoading={query.isFetching && !query.data}
        onSearch={setSearch}
        onValueChange={(next) => {
          onChange(next === "" ? undefined : next);
        }}
      />
    </div>
  );
}
