/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): one declarative card. */
import { useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { Button } from "../../ui/Button";
import { StatusPill } from "../../ui/StatusPill";
import { BagTraceDrawer } from "./BagTraceDrawer";
import { TraceMap } from "./TraceMap";
import type { BagTrace } from "./trace-query";

function Chips({ trace }: { trace: BagTrace }) {
  const { t } = useTranslation();
  const { reading, installed } = trace;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {installed.exposure_days !== null && (
        <StatusPill tone="neutral">
          {t("labTrace.fact.exposure")}: {installed.exposure_days}
        </StatusPill>
      )}
      {reading.paddle_present && reading.has_eggs !== null && (
        <StatusPill tone={reading.has_eggs ? "success" : "neutral"}>
          {t("labTrace.fact.hasEggs")}: {t(reading.has_eggs ? "lab.yes" : "lab.no")}
        </StatusPill>
      )}
      {reading.is_lagged && <StatusPill tone="warning">{t("labTrace.fact.lagged")}</StatusPill>}
    </div>
  );
}

/** A short origin card (where, when installed and collected, days in the field) that does not slow the scan. */
export function CompactTrace({ trace }: { trace: BagTrace }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const [isMapOpen, setMapOpen] = useState(false);
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const { location, installed, reading } = trace;
  const where = [
    t("labTrace.fact.ovitrap") + " " + location.ovitrap.code,
    location.point.code,
    location.block.code,
    location.quadrant.code,
    location.center.name || location.center.code,
  ].join(" · ");
  return (
    <section
      aria-label={t("labTrace.title")}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-surface-muted p-4"
    >
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
        <MapPin aria-hidden="true" className="size-4 text-action" />
        {t("labTrace.title")}
      </h3>
      <p className="m-0 text-sm font-semibold text-ink [overflow-wrap:anywhere]">{where}</p>
      <p className="m-0 text-xs text-ink-2">
        {t("labTrace.step.installed")}: {format(installed.at)} · {t("labTrace.step.collected")}:{" "}
        {format(reading.device_time)}
      </p>
      <Chips trace={trace} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="tertiary"
          size="sm"
          aria-expanded={isMapOpen}
          onClick={() => {
            setMapOpen(!isMapOpen);
          }}
        >
          {t(isMapOpen ? "labTrace.map.hide" : "labTrace.map.show")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDrawerOpen(true);
          }}
        >
          {t("labTrace.openFull")}
        </Button>
      </div>
      {isMapOpen && <TraceMap trace={trace} />}
      {isDrawerOpen && (
        <BagTraceDrawer
          code={trace.bag.code}
          onClose={() => {
            setDrawerOpen(false);
          }}
        />
      )}
    </section>
  );
}
