import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../i18n/use-language";
import { useMe } from "../session/use-me";
import type { Granularity } from "./dashboard-filters";
import { epiWeekOf } from "./epi-week";
import type { EpiConvention } from "./epi-week";

export interface ApiLabel {
  code: string;
  params: Record<string, unknown>;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

const MAX_FRACTION_DIGITS = 2;
const WEEK_COLUMNS = new Set(["epi_week", "week"]);
const WEEK_LABEL = /^\d{4}-W(\d{2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY = "—";

export interface DashboardText {
  /** A `{code, params}` label from the API, translated. */
  label: (label: ApiLabel) => string;
  /** An x axis value: `S45` for a week start, a short date for a day, the category as written. */
  axis: (value: string, granularity: Granularity) => string;
  /** The same as `axis`, spelled out for tooltips and tables. */
  axisLong: (value: string, granularity: Granularity) => string;
  number: (value: number) => string;
  /** A value shown with the unit the API gives it (`percent`, `count`, `eggs`, `ratio`...). */
  withUnit: (value: number | null, unit: string) => string;
  /** One table cell, by its column key. */
  cell: (column: string, value: unknown, granularity: Granularity) => string;
}

interface Context {
  translate: Translate;
  tag: string;
  convention: EpiConvention;
}

/** A catalog entry, or null when the key does not exist (the API may send a newer code). */
function optionalText({ translate }: Context, key: string): string | null {
  const answer = translate(key, { defaultValue: "" });
  return answer === "" ? null : answer;
}

function formatNumber({ tag }: Context, value: number): string {
  return new Intl.NumberFormat(tag, { maximumFractionDigits: MAX_FRACTION_DIGITS }).format(value);
}

function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

function epiLabel(context: Context, isoDate: string): string | null {
  const week = epiWeekOf(isoDate, context.convention);
  return week === null ? null : context.translate("analytics.epiWeek", { week: week.week });
}

function weekLabel(context: Context, value: string): string | null {
  const match = WEEK_LABEL.exec(value);
  return match === null ? null : context.translate("analytics.epiWeek", { week: Number(match[1]) });
}

function shortAxis(context: Context, value: string, granularity: Granularity): string {
  const label = weekLabel(context, value);
  if (label !== null) return label;
  if (!DATE_PATTERN.test(value)) return value;
  if (granularity === "week") return epiLabel(context, value) ?? value;
  const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat(context.tag, options).format(utcDate(value));
}

function longAxis(context: Context, value: string, granularity: Granularity): string {
  const label = weekLabel(context, value);
  if (label !== null) return `${label} · ${value.slice(0, 4)}`;
  if (!DATE_PATTERN.test(value)) return value;
  const options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeZone: "UTC" };
  const date = new Intl.DateTimeFormat(context.tag, options).format(utcDate(value));
  const week = granularity === "week" ? epiLabel(context, value) : null;
  return week === null ? date : `${week} · ${date}`;
}

function formatWithUnit(context: Context, value: number | null, unit: string): string {
  if (value === null) return context.translate("analytics.kpi.noValue");
  const suffix = optionalText(context, `analytics.unit.${unit}`) ?? "";
  if (suffix === "") return formatNumber(context, value);
  return `${formatNumber(context, value)} ${suffix}`;
}

function formatCell(
  context: Context,
  { column, value, granularity }: { column: string; value: unknown; granularity: Granularity },
): string {
  if (typeof value === "number") return formatNumber(context, value);
  if (typeof value !== "string" || value === "") return EMPTY;
  if (WEEK_COLUMNS.has(column)) return longAxis(context, value, "week");
  if (column === "period") return longAxis(context, value, granularity);
  if (column === "state") return optionalText(context, `incidents.state.${value}`) ?? value;
  return value;
}

function buildText(context: Context): DashboardText {
  return {
    label: ({ code, params }) => context.translate(code, { ...params, defaultValue: code }),
    axis: (value, granularity) => shortAxis(context, value, granularity),
    axisLong: (value, granularity) => longAxis(context, value, granularity),
    number: (value) => formatNumber(context, value),
    withUnit: (value, unit) => formatWithUnit(context, value, unit),
    cell: (column, value, granularity) => formatCell(context, { column, value, granularity }),
  };
}

/** Translation and formatting of the `{code, params}` labels, numbers and weeks of a dashboard. */
export function useDashboardText(): DashboardText {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const convention = useMe().organization?.epi_week ?? "iso";
  return useMemo(
    () =>
      buildText({
        translate: t as Translate,
        tag: language === "en" ? "en-US" : "es-MX",
        convention,
      }),
    [t, language, convention],
  );
}
