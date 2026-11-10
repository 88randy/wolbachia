import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import { Card } from "../ui/Card";
import { StatusPill } from "../ui/StatusPill";
import type { BagMetadataResult } from "./bag-metadata-query";
import type { Candidate } from "./lab-query";

interface BagProvenanceProps {
  bag: Candidate;
  facts: BagMetadataResult;
}

export function BagProvenance({ bag, facts }: BagProvenanceProps) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <Card title={t("lab.bag.title")}>
      <dl>
        <dt>{t("lab.bag.block")}</dt>
        <dd>{facts.block?.code ?? t("lab.bag.unavailable")}</dd>
        <dt>{t("lab.bag.date")}</dt>
        <dd>{facts.bag ? format(facts.bag.device_time) : t("lab.bag.unavailable")}</dd>
        <dt>{t("lab.bag.collector")}</dt>
        <dd>{facts.bag?.collector ?? t("lab.bag.unavailable")}</dd>
      </dl>
      <StatusPill tone={bag.is_lagged ? "warning" : "success"}>
        {t(bag.is_lagged ? "lab.bag.lagged" : "lab.bag.onTime")}
      </StatusPill>
      {bag.is_index_excluded && <p>{t("lab.bag.excluded")}</p>}
      {!facts.block && <p>{t("lab.bag.partial")}</p>}
    </Card>
  );
}
