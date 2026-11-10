import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import type { Discrepancy } from "./discrepancy-query";
import { Fact, FactGrid } from "./Fact";
import { DiscrepancyLines } from "./DiscrepancyLines";
import { DiscrepancyHolds } from "./DiscrepancyHolds";

export function DiscrepancyFacts({ record }: { record: Discrepancy }) {
  const { t } = useTranslation();
  return (
    <Card title={t("discrepancies.page.title")}>
      <FactGrid>
        <Fact label={t("discrepancies.field.transfer")}>{record.transfer.code}</Fact>
      </FactGrid>
      <DiscrepancyLines record={record} />
      <DiscrepancyHolds record={record} />
    </Card>
  );
}
