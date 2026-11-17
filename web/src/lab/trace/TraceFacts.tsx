/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): one flat list of facts. */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLanguage } from "../../i18n/use-language";
import { LabFacts } from "../LabFacts";
import type { LabFact } from "../LabFacts";
import { StatusPill } from "../../ui/StatusPill";
import type { BagTrace } from "./trace-query";

function useFacts(trace: BagTrace): LabFact[] {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { location, reading, installed } = trace;
  const meters = (value: number) => t("labTrace.fact.meters", { value: Math.round(value) });
  const label = reading.paddle_type
    ? language === "en" && reading.paddle_type.label_en !== ""
      ? reading.paddle_type.label_en
      : reading.paddle_type.label_es
    : null;
  let eggs: ReactNode = null;
  if (!reading.paddle_present) eggs = t("labTrace.fact.noPaddle");
  else if (reading.has_eggs !== null) eggs = t(reading.has_eggs ? "lab.yes" : "lab.no");
  return [
    { label: t("labTrace.fact.ovitrap"), value: location.ovitrap.code },
    { label: t("labTrace.fact.point"), value: location.point.code },
    { label: t("labTrace.fact.block"), value: location.block.code },
    { label: t("labTrace.fact.quadrant"), value: location.quadrant.code },
    { label: t("labTrace.fact.center"), value: location.center.name || location.center.code },
    {
      label: t("labTrace.fact.exposure"),
      value: installed.exposure_days ?? t("labTrace.fact.exposureUnknown"),
    },
    { label: t("labTrace.fact.hasEggs"), value: eggs },
    { label: t("labTrace.fact.paddleType"), value: label },
    { label: t("labTrace.fact.week"), value: reading.epi_week },
    {
      label: t("labTrace.fact.gpsAccuracy"),
      value:
        reading.capture?.accuracy_m != null
          ? meters(reading.capture.accuracy_m)
          : t("labTrace.fact.gpsMissing"),
    },
    {
      label: t("labTrace.fact.gpsDistance"),
      value: reading.capture ? meters(reading.capture.distance_to_point_m) : null,
    },
  ];
}

/** The facts of the trap and the reading; a late or voided reading says so with an icon and text. */
export function TraceFacts({ trace }: { trace: BagTrace }) {
  const { t } = useTranslation();
  const { reading } = trace;
  return (
    <section aria-label={t("labTrace.facts")} className="flex min-w-0 flex-col gap-3">
      <h3 className="m-0 text-sm font-semibold text-ink">{t("labTrace.facts")}</h3>
      <LabFacts items={useFacts(trace)} />
      <div className="flex flex-wrap gap-2">
        {reading.is_lagged && <StatusPill tone="warning">{t("labTrace.fact.lagged")}</StatusPill>}
        {reading.voided_at && <StatusPill tone="critical">{t("labTrace.fact.voided")}</StatusPill>}
      </div>
      {reading.voided_at && reading.void_reason && (
        <p className="m-0 text-xs text-ink-2">
          {t("labTrace.fact.voidedReason", { reason: reading.void_reason })}
        </p>
      )}
    </section>
  );
}
