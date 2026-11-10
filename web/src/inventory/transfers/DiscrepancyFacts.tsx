import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { StatusPill } from "../../ui/StatusPill";
import type { Discrepancy } from "./discrepancy-query";
import { DiscrepancyLines } from "./DiscrepancyLines";
import { DiscrepancyHolds } from "./DiscrepancyHolds";

export function DiscrepancyFacts({ record }: { record: Discrepancy }) {
  const { t } = useTranslation();
  return (
    <Card title={record.code} headingLevel={1}>
      <StatusPill tone={record.status === "open" ? "warning" : "success"}>
        {t(`discrepancies.status.${record.status}`)}
      </StatusPill>
      <p>
        {t("discrepancies.field.transfer")}: {record.transfer.code}
      </p>
      <DiscrepancyLines record={record} />
      <DiscrepancyHolds record={record} />
      <Link to="/inventory/discrepancies">{t("discrepancies.actions.back")}</Link>
    </Card>
  );
}
