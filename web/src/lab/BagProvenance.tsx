import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import { StatusPill } from "../ui/StatusPill";
import type { BagMetadataResult } from "./bag-metadata-query";
import type { Candidate } from "./lab-query";

interface BagProvenanceProps {
  bag: Candidate;
  facts: BagMetadataResult;
}

function useWhereLine(facts: BagMetadataResult) {
  const { t } = useTranslation();
  const parts = [
    facts.ovitrap && t("lab.bag.ovitrap", { code: facts.ovitrap.code }),
    facts.point && t("lab.bag.point", { code: facts.point.code }),
    facts.block && t("lab.bag.blockOf", { code: facts.block.code }),
  ];
  return parts.filter(Boolean).join(" · ");
}

/** The bag being counted, in large text: code, where it came from and when it was collected. */
export function BagProvenance({ bag, facts }: BagProvenanceProps) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const where = useWhereLine(facts);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="m-0 text-3xl leading-9 font-bold tracking-tight text-ink">{bag.code}</h2>
        {where && <p className="m-0 text-base text-ink-2">{where}</p>}
        {facts.bag && (
          <p className="m-0 text-sm text-ink-3">
            {t("lab.bag.collectedOn", { date: format(facts.bag.device_time) })}
          </p>
        )}
      </div>
      <StatusPill tone={bag.is_lagged ? "warning" : "success"}>
        {t(bag.is_lagged ? "lab.bag.lagged" : "lab.bag.onTime")}
      </StatusPill>
    </div>
  );
}
