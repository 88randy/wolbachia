import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import type { RuleParameter } from "./rules-query";
import { ParameterSummaryDetails } from "./ParameterSummaryDetails";
/** Current value, dates and bounds use the same raised surface as the other records. */
export function ParameterSummary({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  return (
    <Card title={t("rules.summary.title")} titleId="rule-summary-title">
      <ParameterSummaryDetails parameter={parameter} />
    </Card>
  );
}
