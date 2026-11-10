import { unwrap } from "@wolbachia/api-client";
import { TrainingCommandDialog } from "./TrainingCommandDialog";
import { IDENTITY_FIELDS } from "./training-fields";
import { trainingIdentityBody } from "./training-input";
import type { TrainingScope } from "./training-query";
export function TrainingCreate({ scope }: { scope: TrainingScope }) {
  return (
    <TrainingCommandDialog
      scope={scope}
      title="trainings.course.create"
      description="trainings.course.createHint"
      fields={IDENTITY_FIELDS}
      triggerVariant="primary"
      execute={async (draft, signal) =>
        unwrap(
          await scope.client.POST("/api/v1/trainings/", {
            body: trainingIdentityBody(draft),
            signal,
          }),
        )
      }
    />
  );
}
