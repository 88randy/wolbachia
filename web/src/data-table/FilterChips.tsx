import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { FilterChip } from "./FilterChip";
import { dayLabel } from "./filter-dates";
import type { FilterDefinition, TableController } from "./table-types";

interface Chip {
  id: string;
  name: string;
  value: string;
  onRemove?: () => void;
}

function chipValue(
  filter: FilterDefinition,
  value: string,
  { t, language }: { t: TFunction; language: string },
) {
  if (filter.kind === "select") {
    const option = filter.options.find((candidate) => candidate.value === value);
    return option === undefined ? value : t(option.labelKey);
  }
  if (filter.input === "hidden") return t("table.filters.applied");
  if (filter.input === "date-from" || filter.input === "date-to")
    return dayLabel(
      value,
      language,
      filter.input === "date-to" && filter.dateFormat === "datetime",
    );
  return value;
}

function useChips(controller: TableController): Chip[] {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { config, state } = controller;
  return config.filters.flatMap((filter): Chip[] => {
    const value = state.filters[filter.key];
    const name = t(filter.labelKey);
    if (value !== undefined)
      return [
        {
          id: filter.key,
          name,
          value: chipValue(filter, value, { t, language }),
          onRemove: () => {
            controller.setFilter(filter.key, undefined);
          },
        },
      ];
    if (filter.kind === "select" && filter.defaultValue !== undefined) {
      const label = chipValue(filter, filter.defaultValue, { t, language });
      return [{ id: filter.key, name, value: t("table.filters.default", { value: label }) }];
    }
    return [];
  });
}

/** Active filters as small chips under the toolbar, with "Limpiar filtros". Defaults are chips too. */
export function FilterChips({ controller }: { controller: TableController }) {
  const { t } = useTranslation();
  const chips = useChips(controller);
  const voided = controller.config.supportsVoided && controller.state.includeVoided;
  if (chips.length === 0 && !voided) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul
        className="m-0 flex list-none flex-wrap gap-1.5 p-0"
        aria-label={t("table.filters.active")}
      >
        {chips.map((chip) => (
          <li key={chip.id}>
            <FilterChip name={chip.name} value={chip.value} onRemove={chip.onRemove} />
          </li>
        ))}
        {voided && (
          <li>
            <FilterChip
              name={t("table.filters.includeVoided")}
              value=""
              onRemove={() => {
                controller.setIncludeVoided(false);
              }}
            />
          </li>
        )}
      </ul>
      {controller.hasActiveFilters && (
        <button
          type="button"
          className="h-7 rounded-md px-2 text-xs font-semibold text-action-strong hover:bg-tint"
          onClick={controller.clearFilters}
        >
          {t("table.filters.clear")}
        </button>
      )}
    </div>
  );
}
