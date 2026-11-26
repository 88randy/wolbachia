/* eslint-disable max-lines-per-function -- presentational JSX of a dashboard widget; splitting it into one-use fragments would hurt readability. */
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import {
  Activity,
  Bike,
  Bug,
  ClipboardCheck,
  Droplets,
  FlaskConical,
  Fuel,
  ListChecks,
  Percent,
  TriangleAlert,
  CircleCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dashboard } from "./dashboard-query";
import { useDashboardText } from "./use-dashboard-text";

type Indicator = Dashboard["indicators"][number];

const ICONS: Readonly<Record<string, LucideIcon>> = {
  tasks_planned: ListChecks,
  tasks_done: ClipboardCheck,
  coverage: Percent,
  couriers_in_field: Bike,
  incidents_open: TriangleAlert,
  incidents_closed: CircleCheck,
  fuel_litres_per_km: Fuel,
  ovitraps_inspected: Bug,
  ovitraps_positive: Bug,
  positive_index: Percent,
  eggs_per_ovitrap: Droplets,
  samples_valid: FlaskConical,
  samples_positive: FlaskConical,
  prevalence: Percent,
};

/** Every number links to the records behind it, when the screen for them exists. */
const LINKS: Readonly<Record<string, Pick<LinkProps, "to" | "search">>> = {
  incidents_open: { to: "/incidents", search: { state: "open" } },
  incidents_closed: { to: "/incidents", search: { state: "closed" } },
};

function Body({ indicator }: { indicator: Indicator }) {
  const text = useDashboardText();
  const Icon = ICONS[indicator.key] ?? Activity;
  return (
    <>
      <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        <Icon aria-hidden="true" strokeWidth={1.75} className="size-4 flex-none text-action" />
        {text.label(indicator.label)}
      </span>
      <span className="text-3xl leading-9 font-bold tracking-tight text-ink tabular-nums">
        {text.withUnit(indicator.value, indicator.unit)}
      </span>
    </>
  );
}

const CELL =
  "flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-ink no-underline shadow-card";

/** KPI cards: label, one big number with its unit. Linked when the records behind exist. */
export function IndicatorCards({
  indicators,
  label,
}: {
  indicators: readonly Indicator[];
  label: string;
}) {
  return (
    <ul
      aria-label={label}
      className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,11.5rem),1fr))] gap-4 p-0"
    >
      {indicators.map((indicator) => {
        const link = LINKS[indicator.key];
        return (
          <li key={indicator.key} className="min-w-0">
            {link ? (
              <Link
                {...link}
                className={cn(
                  CELL,
                  "h-full transition-colors hover:border-action/40 hover:shadow-overlay",
                )}
              >
                <Body indicator={indicator} />
              </Link>
            ) : (
              <div className={cn(CELL, "h-full")}>
                <Body indicator={indicator} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
