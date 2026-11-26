/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a dashboard widget; splitting it into one-use fragments would hurt readability. */
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { NO_NAME } from "../lookups/use-reference-names";
import { centersOptions } from "../centers/centers-query";
import { useSessionIdentity } from "../session/use-session-identity";
import { Button } from "../ui/Button";
import { SelectMenu } from "../ui/SelectMenu";
import { GRANULARITIES, PERIODS } from "./dashboard-filters";
import type { DashboardFilters, Granularity, Period } from "./dashboard-filters";
import { quadrantChoicesOptions } from "./dashboard-query";

interface DashboardFilterBarProps {
  filters: DashboardFilters;
  defaultPeriod: Period;
  /** Only the entomology and prevalence dashboards group by quadrant; operations by center too. */
  onChange: (next: DashboardFilters) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-44 flex-1 flex-col gap-1">
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      {children}
    </div>
  );
}

function Chip({ name, value, onRemove }: { name: string; value: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t("analytics.filters.remove", { name: `${name}: ${value}` })}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line-strong bg-tint px-3 text-xs font-semibold text-action-strong hover:border-action"
    >
      <span>
        {name}: {value}
      </span>
      <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
    </button>
  );
}

/** Period, grouping, center and quadrant, as pickers plus removable chips of what is applied. */
export function DashboardFilterBar({ filters, defaultPeriod, onChange }: DashboardFilterBarProps) {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const centers = useQuery(centersOptions(client, identity));
  const quadrants = useQuery(quadrantChoicesOptions(client, identity, filters.center));
  const all = { value: "", label: t("analytics.filters.all") };
  const centerOptions = [
    all,
    ...(centers.data ?? []).map((center) => ({ value: center.id, label: center.name })),
  ];
  const quadrantOptions = [all, ...(quadrants.data ?? [])];
  const labelOf = (options: readonly { value: string; label: string }[], value: string) =>
    options.find((option) => option.value === value)?.label ?? NO_NAME;
  const set = (patch: Partial<DashboardFilters>) => {
    onChange({ ...filters, ...patch });
  };
  const hasExtra =
    filters.period !== defaultPeriod ||
    filters.granularity !== "week" ||
    filters.center !== "" ||
    filters.quadrant !== "";
  const periodLabel = (period: Period) => t(`analytics.period.${period}`);
  const granularityLabel = (granularity: Granularity) => t(`analytics.granularity.${granularity}`);
  return (
    <section
      aria-label={t("analytics.filters.label")}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <div className="flex flex-wrap gap-4">
        <Field label={t("analytics.filters.period")}>
          <SelectMenu
            id="dashboard-period"
            value={filters.period}
            options={PERIODS.map((period) => ({ value: period, label: periodLabel(period) }))}
            onValueChange={(value) => {
              set({ period: PERIODS.find((period) => period === value) ?? defaultPeriod });
            }}
          />
        </Field>
        <Field label={t("analytics.filters.granularity")}>
          <SelectMenu
            id="dashboard-granularity"
            value={filters.granularity}
            options={GRANULARITIES.map((granularity) => ({
              value: granularity,
              label: granularityLabel(granularity),
            }))}
            onValueChange={(value) => {
              set({ granularity: GRANULARITIES.find((item) => item === value) ?? "week" });
            }}
          />
        </Field>
        {centerOptions.length > 2 && (
          <Field label={t("analytics.filters.center")}>
            <SelectMenu
              id="dashboard-center"
              value={filters.center}
              options={centerOptions}
              onValueChange={(value) => {
                set({ center: value, quadrant: "" });
              }}
            />
          </Field>
        )}
        <Field label={t("analytics.filters.quadrant")}>
          <SelectMenu
            id="dashboard-quadrant"
            value={filters.quadrant}
            options={quadrantOptions}
            onValueChange={(value) => {
              set({ quadrant: value });
            }}
          />
        </Field>
      </div>
      {hasExtra && (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label={t("analytics.filters.active")}
          role="group"
        >
          {filters.period !== defaultPeriod && (
            <Chip
              name={t("analytics.filters.period")}
              value={periodLabel(filters.period)}
              onRemove={() => {
                set({ period: defaultPeriod });
              }}
            />
          )}
          {filters.granularity !== "week" && (
            <Chip
              name={t("analytics.filters.granularity")}
              value={granularityLabel(filters.granularity)}
              onRemove={() => {
                set({ granularity: "week" });
              }}
            />
          )}
          {filters.center !== "" && (
            <Chip
              name={t("analytics.filters.center")}
              value={labelOf(centerOptions, filters.center)}
              onRemove={() => {
                set({ center: "", quadrant: "" });
              }}
            />
          )}
          {filters.quadrant !== "" && (
            <Chip
              name={t("analytics.filters.quadrant")}
              value={labelOf(quadrantOptions, filters.quadrant)}
              onRemove={() => {
                set({ quadrant: "" });
              }}
            />
          )}
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => {
              onChange({ period: defaultPeriod, granularity: "week", center: "", quadrant: "" });
            }}
          >
            {t("analytics.filters.clear")}
          </Button>
        </div>
      )}
    </section>
  );
}
