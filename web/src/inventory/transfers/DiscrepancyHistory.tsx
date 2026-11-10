import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import type { Discrepancy } from "./discrepancy-query";
import { DiscrepancyEvent } from "./DiscrepancyEvent";

export function DiscrepancyHistory({ record }: { record: Discrepancy }) {
  const { t } = useTranslation();
  return (
    <Card title={t("discrepancies.history.title")}>
      {record.transfer.events.map((event) => (
        <DiscrepancyEvent key={event.id} event={event} />
      ))}
    </Card>
  );
}
