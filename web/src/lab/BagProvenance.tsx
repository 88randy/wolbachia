import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
import { BagTracePanel } from "./trace/BagTracePanel";
import type { Candidate } from "./lab-query";

/** The bag being counted, in large text, with its short origin card (never blocks the count). */
export function BagProvenance({ bag }: { bag: Candidate }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="m-0 text-3xl leading-9 font-bold tracking-tight text-ink">{bag.code}</h2>
        <StatusPill tone={bag.is_lagged ? "warning" : "success"}>
          {t(bag.is_lagged ? "lab.bag.lagged" : "lab.bag.onTime")}
        </StatusPill>
      </div>
      <BagTracePanel code={bag.code} variant="compact" />
    </div>
  );
}
