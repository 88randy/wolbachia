import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import { InlineNotice } from "../../ui/InlineNotice";
import { Card } from "../../ui/Card";
import { EvaluationNoticePolicies } from "./EvaluationNoticePolicies";
import type { EvaluationScope } from "./evaluation-query";
export function EvaluationNotice({ scope }: { scope: EvaluationScope }) {
  const { t } = useTranslation();
  const can = useCan();
  if (!can("evaluation.read")) return null;
  return (
    <Card title={t("evaluations.notice.title")}>
      <InlineNotice tone="warning">{t("evaluations.notice.gap")}</InlineNotice>
      {can("training.manage") && <EvaluationNoticePolicies scope={scope} />}
    </Card>
  );
}
