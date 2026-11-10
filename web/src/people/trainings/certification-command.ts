import { unwrap } from "@wolbachia/api-client";
import { certificationBody } from "./training-input";
import type { TrainingDraft } from "./training-input";
import type { PersonContext } from "./person-context";
import type { TrainingScope } from "./training-query";
export async function createCertification(
  scope: TrainingScope,
  request: { context: PersonContext; draft: TrainingDraft; signal: AbortSignal },
) {
  return unwrap(
    await scope.client.POST("/api/v1/users/{subject_id}/trainings/", {
      params: { path: { subject_id: request.context.subject } },
      signal: request.signal,
      body: certificationBody({
        ...request.draft,
        center: request.context.center,
        quadrant: request.context.quadrant,
      }),
    }),
  );
}
