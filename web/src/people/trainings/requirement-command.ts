import { unwrap } from "@wolbachia/api-client";
import { requirementBody } from "./requirement-input";
import { valueOf } from "./training-input";
import type { TrainingDraft } from "./training-input";
import type { PersonContext } from "./person-context";
import type { Requirement, TrainingScope } from "./training-query";
interface Request {
  draft: TrainingDraft;
  signal: AbortSignal;
  context: PersonContext;
  revision: number;
  requirement: Requirement | undefined;
}
export async function publishRequirement(scope: TrainingScope, request: Request) {
  return unwrap(
    await scope.client.POST("/api/v1/training-requirements/{action_key}/versions/", {
      params: {
        path: { action_key: request.requirement?.action ?? valueOf(request.draft, "action") },
      },
      signal: request.signal,
      body: requirementBody(request.draft, {
        context: request.context,
        revision: request.revision,
        existing: request.requirement?.acceptable_versions,
      }),
    }),
  );
}
