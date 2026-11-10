/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { ListFilter, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TableController } from "../../data-table/table-types";
import { useFormatCalendarDate } from "../../format/use-formatters";
import { Button } from "../../ui/Button";
import { SelectMenu } from "../../ui/SelectMenu";
import { decodeRange, encodeRange } from "./date-range";
import { DateRangeField } from "./DateRangeField";
import { SegmentedFilter } from "./SegmentedFilter";
import { useDebouncedSearch } from "./use-debounced-search";

export interface ToolbarOption {
  value: string;
  label: string;
}

export interface ToolbarSelect {
  key: string;
  label: string;
  options: readonly ToolbarOption[];
}

export interface ListToolbarProps {
  controller: TableController;
  search?: { key: string; label: string };
  /** Status quick filter: one segmented control (the empty value means "all"). */
  segments?: ToolbarSelect;
  /** Selects inside the "Filters" popover. */
  selects?: readonly ToolbarSelect[];
  /** The ONE calendar range, stored in one key (`encodeRange`). */
  range?: { key: string; label: string };
  /** Page actions and export, on the right. */
  actions?: ReactNode;
}

/**
 * The toolbar of the filters standard: live search, a "Filters" popover (selects and one calendar
 * range) that applies at once, a status segmented control, removable chips and "Clear filters".
 * All state lives in the address through the table controller.
 */
export function ListToolbar(props: ListToolbarProps) {
  const { controller, search, segments, selects = [], range, actions } = props;
  const { t } = useTranslation();
  const format = useFormatCalendarDate();
  const filters = controller.state.filters;
  const searchBox = useDebouncedSearch(search ? filters[search.key] : undefined, (value) => {
    if (search) controller.setFilter(search.key, value);
  });
  const rangeValue = decodeRange(range ? filters[range.key] : undefined);
  const chips = [
    ...(search && filters[search.key] !== undefined
      ? [
          {
            id: search.key,
            name: search.label,
            value: filters[search.key] ?? "",
            remove: () => {
              controller.setFilter(search.key, undefined);
            },
          },
        ]
      : []),
    ...selects.flatMap((select) => {
      const value = filters[select.key];
      const label = select.options.find((option) => option.value === value)?.label;
      return value === undefined || label === undefined
        ? []
        : [
            {
              id: select.key,
              name: select.label,
              value: label,
              remove: () => {
                controller.setFilter(select.key, undefined);
              },
            },
          ];
    }),
    ...(range && decodeRange(filters[range.key]).from !== undefined
      ? [
          {
            id: range.key,
            name: range.label,
            value: `${format(rangeValue.from ?? "")} – ${format(rangeValue.to ?? rangeValue.from ?? "")}`,
            remove: () => {
              controller.setFilter(range.key, undefined);
            },
          },
        ]
      : []),
  ];
  const popoverCount = chips.filter((chip) => chip.id !== search?.key).length;
  return (
    <section aria-label={t("regulatory.common.filters")} className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        {search && (
          <div className="relative min-w-56 flex-1 sm:max-w-sm">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2"
            />
            <input
              type="search"
              aria-label={search.label}
              placeholder={search.label}
              value={searchBox.value}
              onChange={(event) => {
                searchBox.onChange(event.target.value);
              }}
              className="min-h-[var(--web-control-lg)] w-full rounded-lg border border-line-strong bg-surface pr-3 pl-9 text-[13px] text-ink"
            />
          </div>
        )}
        {segments && <SegmentedFilter controller={controller} segments={segments} />}
        {(selects.length > 0 || range) && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="secondary" leadingIcon={<ListFilter aria-hidden="true" />}>
                {t("regulatory.common.filters")}
                {popoverCount > 0 ? ` (${String(popoverCount)})` : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 gap-4 p-4">
              {selects.map((select) => (
                <div key={select.key} className="flex flex-col gap-1.5">
                  <label
                    htmlFor={`filter-${select.key}`}
                    className="text-xs font-semibold text-ink-2"
                  >
                    {select.label}
                  </label>
                  <SelectMenu
                    id={`filter-${select.key}`}
                    value={filters[select.key] ?? ""}
                    options={[{ value: "", label: t("regulatory.common.all") }, ...select.options]}
                    onValueChange={(value) => {
                      controller.setFilter(select.key, value === "" ? undefined : value);
                    }}
                  />
                </div>
              ))}
              {range && (
                <DateRangeField
                  label={range.label}
                  from={rangeValue.from}
                  to={rangeValue.to}
                  onChange={(next) => {
                    controller.setFilter(range.key, encodeRange(next.from, next.to));
                  }}
                />
              )}
            </PopoverContent>
          </Popover>
        )}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {chips.length > 0 && (
        <ul
          className="m-0 flex list-none flex-wrap items-center gap-2 p-0"
          aria-label={t("table.filters.active")}
        >
          {chips.map((chip) => (
            <li key={chip.id}>
              <button
                type="button"
                aria-label={t("table.filters.remove", { filter: chip.name, value: chip.value })}
                onClick={chip.remove}
                className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-tint px-3 text-xs font-semibold text-action hover:underline"
              >
                {chip.name}: {chip.value}
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={controller.clearFilters}
              className="min-h-7 rounded-full px-2 text-xs font-semibold text-ink-2 underline hover:text-ink"
            >
              {t("regulatory.common.clear")}
            </button>
          </li>
        </ul>
      )}
    </section>
  );
}
