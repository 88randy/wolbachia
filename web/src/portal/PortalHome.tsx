import { Link, useParams } from "@tanstack/react-router";
import { Bug, ChartColumn, Map as MapIcon, MapPinned, Percent, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PortalCutoff } from "./PortalCutoff";
import { usePortalHome, SUMMARY_CODES } from "./portal-data";
import type { SummaryCode } from "./portal-data";
import { usePortalFormat } from "./use-portal-format";

const ICONS: Readonly<Record<SummaryCode, LucideIcon>> = {
  releases_total: Bug,
  quadrants_covered: MapPinned,
  readings_total: Search,
  egg_positivity: Percent,
};

const CTA =
  "inline-flex min-h-12 items-center gap-2 rounded-xl px-5 text-[15px] font-semibold no-underline";

/** W69: a plain sentence, big indicator cards and the date of the data. Aggregates only. */
export function PortalHome() {
  const { t } = useTranslation();
  const { orgSlug } = useParams({ strict: false });
  const slug = orgSlug ?? "";
  const home = usePortalHome(slug).data;
  const format = usePortalFormat();
  if (!home) return null;
  const shown = SUMMARY_CODES.filter((code) => home.enabled.includes(code));
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <PortalCutoff iso={home.cutoff} />
        <h1 className="m-0 max-w-3xl text-3xl leading-tight font-bold tracking-tight text-navy sm:text-4xl">
          {t("portal.home.title", { organization: home.organization.name })}
        </h1>
        <p className="m-0 max-w-2xl text-lg leading-7 text-ink-2">{t("portal.home.lead")}</p>
      </section>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-5 p-0">
        {shown.map((code) => {
          const Icon = ICONS[code];
          const value = home.values[code];
          return (
            <li
              key={code}
              className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6 shadow-card"
            >
              <span
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-2xl bg-tint text-action"
              >
                <Icon className="size-6" />
              </span>
              <p className="m-0 text-sm font-semibold text-ink-2">{t(`portal.card.${code}`)}</p>
              <p className="m-0 text-5xl leading-none font-bold tracking-tight text-navy tabular-nums">
                {value === null || value === undefined
                  ? t("portal.card.noData")
                  : code === "egg_positivity"
                    ? `${format.number(value)} %`
                    : format.number(value)}
              </p>
              <p className="m-0 text-[13px] leading-5 text-ink-2">
                {t(`portal.card.${code}.hint`)}
              </p>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-3">
        {home.enabled.includes("releases_by_week") && (
          <Link
            to="/portal/$orgSlug/trends"
            params={{ orgSlug: slug }}
            className={`${CTA} bg-action text-on-action hover:bg-action-strong`}
          >
            <ChartColumn aria-hidden="true" className="size-5" />
            {t("portal.home.seeTrends")}
          </Link>
        )}
        {home.enabled.includes("coverage") && (
          <Link
            to="/portal/$orgSlug/map"
            params={{ orgSlug: slug }}
            className={`${CTA} border border-line-strong bg-surface text-ink hover:bg-tint`}
          >
            <MapIcon aria-hidden="true" className="size-5" />
            {t("portal.home.seeMap")}
          </Link>
        )}
      </div>
    </div>
  );
}
