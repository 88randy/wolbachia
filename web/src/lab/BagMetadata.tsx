import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import { Card } from "../ui/Card";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { StatusPill } from "../ui/StatusPill";
import { bagMetadataOptions } from "./bag-metadata-query";
import type { Candidate, LabScope } from "./lab-query";
/** Optional provenance never blocks the independently authorized count command. */
export function BagMetadata({ scope, bag }: { scope: LabScope; bag: Candidate }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const query = useQuery(bagMetadataOptions(scope, bag));
  if (query.isPending) return <CardSkeleton />;
  if (query.isError) return <ErrorState onRetry={() => { void query.refetch(); }} />;
  const facts = query.data;
  return (
    <Card title={t("lab.bag.title")}>
      <dl><dt>{t("lab.bag.block")}</dt><dd>{facts.block?.code ?? t("lab.bag.unavailable")}</dd>
        <dt>{t("lab.bag.date")}</dt><dd>{facts.bag ? format(facts.bag.device_time) : t("lab.bag.unavailable")}</dd>
        <dt>{t("lab.bag.collector")}</dt><dd>{facts.bag?.collector ?? t("lab.bag.unavailable")}</dd></dl>
      <StatusPill tone={bag.is_lagged ? "warning" : "success"}>{t(bag.is_lagged ? "lab.bag.lagged" : "lab.bag.onTime")}</StatusPill>
      {bag.is_index_excluded && <p>{t("lab.bag.excluded")}</p>}
      {!facts.block && <p>{t("lab.bag.partial")}</p>}
    </Card>
  );
}
