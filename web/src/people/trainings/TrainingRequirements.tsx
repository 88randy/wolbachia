import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { Card } from "../../ui/Card";
import { TrainingContextSearch } from "./TrainingContextSearch";
import { RequirementList } from "./RequirementList";
import { readPersonContext, canReadTrainingContext } from "./person-context";
import type { TrainingScope } from "./training-query";
export function TrainingRequirements({ scope }: { scope: TrainingScope }) {
  const { t } = useTranslation();
  const me = useMe();
  const context = readPersonContext(useSearch({ strict: false }));
  const isAllowed = canReadTrainingContext(me, context);
  return (
    <Card title={t("trainings.requirement.title")}>
      <TrainingContextSearch
        key={`search:${context.center}:${context.quadrant}`}
        context={context}
      />
      {isAllowed && (
        <RequirementList
          key={`requirements:${context.center}:${context.quadrant}`}
          scope={scope}
          context={context}
        />
      )}
    </Card>
  );
}
