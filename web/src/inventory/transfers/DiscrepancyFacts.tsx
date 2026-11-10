import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import type { Discrepancy } from "./discrepancy-query";
import { DiscrepancyLines } from "./DiscrepancyLines";
import { DiscrepancyHolds } from "./DiscrepancyHolds";

export function DiscrepancyFacts({ record }: { record: Discrepancy }) {
  const { t } = useTranslation();
  return (
    <Card title={t("discrepancies.field.transfer")}>
      <p>{record.transfer.code}</p>
      <DiscrepancyLines record={record} />
      <DiscrepancyHolds record={record} />
    </Card>
  );
}
