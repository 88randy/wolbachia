import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { RubricVersions } from "./RubricVersions";
import { RubricLookupForm } from "./RubricLookupForm";
import { RubricLookupStatus } from "./RubricLookupStatus";
import { useRubricLookup } from "./use-rubric-lookup";
import type { EvaluationScope, RubricVersion } from "./evaluation-query";
interface Props {
  scope: EvaluationScope;
  onSelect?: (version: RubricVersion) => void;
}
export function RubricLookup({ scope, onSelect }: Props) {
  const { t } = useTranslation();
  const model = useRubricLookup(scope);
  const rubric = model.rubric;
  return (
    <Card title={t("evaluations.rubric.title")}>
      <RubricLookupForm scope={scope} model={model} />
      <RubricLookupStatus model={model} />
      {rubric && (
        <>
          <p>
            {rubric.code}
            {t("evaluations.rubric.separator")}
            {rubric.name}
          </p>
          <p>{t("evaluations.rubric.choose")}</p>
          <RubricVersions
            key={rubric.id}
            scope={scope}
            id={rubric.id}
            {...(onSelect ? { onSelect } : {})}
          />
        </>
      )}
    </Card>
  );
}
