import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { readPersonContext, canReadPersonContext } from "./person-context";
import { PersonTrainingSearch } from "./PersonTrainingSearch";
import { PersonTrainingRecord } from "./PersonTrainingRecord";
import type { TrainingScope } from "./training-query";
export function PersonTrainings({ scope }: { scope: TrainingScope }) {
  const { t } = useTranslation();
  const me = useMe();
  const context = readPersonContext(useSearch({ strict: false }));
  const isAllowed = canReadPersonContext(me, context);
  return (
    <Card title={t("trainings.person.title")}>
      <p>{t("trainings.person.lookupHint")}</p>
      <PersonTrainingSearch key={`search:${JSON.stringify(context)}`} context={context} />
      {context.subject && !isAllowed && (
        <InlineNotice tone="warning">{t("trainings.course.unavailable")}</InlineNotice>
      )}
      {isAllowed && (
        <PersonTrainingRecord
          key={`record:${JSON.stringify(context)}`}
          scope={scope}
          context={context}
        />
      )}
    </Card>
  );
}
