import { enUS, es } from "react-day-picker/locale";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from "../i18n/use-language";
import { dateOfFilter, filterValueOfDate } from "./filter-dates";
import type { TableController, TextFilter } from "./table-types";

interface FilterDateRangeProps {
  from: TextFilter;
  to: TextFilter;
  controller: TableController;
}

/** One calendar range picker for a `date-from` / `date-to` pair. Applies on every pick. */
export function FilterDateRange({ from, to, controller }: FilterDateRangeProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const selected: DateRange = {
    from: dateOfFilter(controller.state.filters[from.key]),
    to: dateOfFilter(controller.state.filters[to.key], to.dateFormat === "datetime"),
  };
  const apply = (range: DateRange | undefined) => {
    const patch = {
      [from.key]: range?.from ? filterValueOfDate(range.from, from, "start") : undefined,
      [to.key]: range?.to ? filterValueOfDate(range.to, to, "end") : undefined,
    };
    if (controller.setFilters) controller.setFilters(patch);
    else controller.setFilter(from.key, patch[from.key]);
  };
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
      <legend className="mb-1.5 text-xs font-bold text-ink">{t("table.filters.dates")}</legend>
      <Calendar
        mode="range"
        numberOfMonths={1}
        locale={language === "en" ? enUS : es}
        selected={selected}
        onSelect={apply}
        className="rounded-lg border border-line bg-surface p-2"
      />
      {(selected.from ?? selected.to) && (
        <button
          type="button"
          className="self-start text-[13px] font-semibold text-action-strong hover:underline"
          onClick={() => {
            apply(undefined);
          }}
        >
          {t("table.filters.clearDates")}
        </button>
      )}
    </fieldset>
  );
}
