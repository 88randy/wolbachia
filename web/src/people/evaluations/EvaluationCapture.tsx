import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { RubricLookup } from "./RubricLookup";
import { EvaluationEntry } from "./EvaluationEntry";
import { useEvaluationForm } from "./use-evaluation-form";
import type { EvaluationScope } from "./evaluation-query";
export function EvaluationCapture({ scope }: { scope: EvaluationScope }) {
  const { t } = useTranslation();
  const form = useEvaluationForm(scope);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <RubricLookup
        scope={scope}
        {...(form.command.status === null ? { onSelect: form.select } : {})}
      />
      <Card title={t("evaluations.form.title")}>
        <EvaluationEntry form={form} />
      </Card>
    </div>
  );
}
