import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { trainingsOptions } from "./training-query";
import type { TrainingScope } from "./training-query";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { Card } from "../../ui/Card";
import { useMe } from "../../session/use-me";
import { canPublishTraining } from "./training-input";
import { TrainingPublish } from "./TrainingPublish";
import { TrainingVersions } from "./TrainingVersions";

export function TrainingCourse({ scope, code }: { scope: TrainingScope; code: string }) {
  const { t } = useTranslation();
  const me = useMe();
  const query = useQuery(trainingsOptions(scope, { code }));
  if (query.isPending) return <CardSkeleton />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  const course = query.data.results.find((row) => row.code === code);
  if (!course)
    return <InlineNotice tone="warning">{t("trainings.course.unavailable")}</InlineNotice>;
  return (
    <Card title={course.name}>
      <TrainingVersions scope={scope} course={course} />
      {canPublishTraining(me) && (
        <TrainingPublish
          scope={scope}
          course={course}
          isFresh={!query.isFetching && !query.isPlaceholderData}
        />
      )}
    </Card>
  );
}
