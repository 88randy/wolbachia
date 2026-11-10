import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { StatusPill } from "../../ui/StatusPill";
import { EligibilityFacts } from "./EligibilityFacts";
import { eligibilityBlockerKey } from "./eligibility-blockers";
export function EligibilityResult({ result }: { result: Schemas["EligibilityRead"] }) {
  const { t } = useTranslation();
  return (
    <Card title={t("trainings.eligibility.title")}>
      <StatusPill tone={result.training_eligible ? "success" : "critical"}>
        {t(
          result.training_eligible
            ? "trainings.eligibility.eligible"
            : "trainings.eligibility.blocked",
        )}
      </StatusPill>
      <p>{t("trainings.eligibility.factual")}</p>
      {!result.training_eligible && (
        <InlineNotice tone="warning">{t("trainings.eligibility.unblocker")}</InlineNotice>
      )}
      <ul>
        {result.blockers.map((code) => (
          <li key={code}>{t(eligibilityBlockerKey(code))}</li>
        ))}
      </ul>
      <EligibilityFacts result={result} />
    </Card>
  );
}
