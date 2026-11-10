import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import { InlineNotice } from "../../ui/InlineNotice";
import { EvaluationHistory } from "./EvaluationHistory";
import { EvaluationAttempts } from "./EvaluationAttempts";
import { EvaluationNotice } from "./EvaluationNotice";
import type { EvaluationScope } from "./evaluation-query";
export function EvaluationReadWorkspace({ scope, item }: { scope: EvaluationScope; item: string }) {
  const { t } = useTranslation();
  const can = useCan();
  if (!can("evaluation.read"))
    return <InlineNotice tone="info">{t("evaluations.page.private")}</InlineNotice>;
  return (
    <>
      <EvaluationHistory scope={scope} />
      {item && <EvaluationAttempts scope={scope} id={item} />}
      <EvaluationNotice scope={scope} />
    </>
  );
}
