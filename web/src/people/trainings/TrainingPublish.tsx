import { useState } from "react";
import { unwrap } from "@wolbachia/api-client";
import { TrainingCommandDialog } from "./TrainingCommandDialog";
import { VERSION_FIELDS } from "./training-fields";
import { trainingVersionBody } from "./training-input";
import type { Training, TrainingScope } from "./training-query";
interface Props {
  scope: TrainingScope;
  course: Training;
  isFresh: boolean;
}
export function TrainingPublish({ scope, course, isFresh }: Props) {
  const [reviewedRevision, setRevision] = useState(course.revision);
  return (
    <TrainingCommandDialog
      scope={scope}
      title="trainings.course.publish"
      description="trainings.course.publishHint"
      fields={VERSION_FIELDS}
      initial={{ is_active: "true" }}
      hasActive
      isBlocked={!isFresh || reviewedRevision !== course.revision}
      onOpen={() => {
        setRevision(course.revision);
      }}
      execute={async (draft, signal) =>
        unwrap(
          await scope.client.POST("/api/v1/trainings/{id}/versions/", {
            params: { path: { id: course.id } },
            body: trainingVersionBody(draft, reviewedRevision),
            signal,
          }),
        )
      }
    />
  );
}
