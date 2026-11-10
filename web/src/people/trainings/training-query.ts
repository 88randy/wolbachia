import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas, operations } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import type { SessionIdentity } from "../../session/org-scoped-query";
import type { PersonContext } from "./person-context";

export interface TrainingScope {
  client: ApiClient;
  identity: SessionIdentity;
}
export type Training = Schemas["TrainingRead"];
export type TrainingVersion = Schemas["TrainingVersionRead"];
export type Certificate = Schemas["CertificationSummary"];
export type TrainingQuery = NonNullable<operations["trainings_list"]["parameters"]["query"]>;
export type CertificateQuery = NonNullable<
  operations["users_trainings_list"]["parameters"]["query"]
>;
export type EligibilityQuery = NonNullable<
  operations["users_eligibility_retrieve"]["parameters"]["query"]
>;
export type Requirement = Schemas["RequirementRead"];
export const TRAINING_RESOURCE = "peopleTrainings";
export const TRAINING_PAGE_SIZE = 25;

export function trainingsOptions(scope: TrainingScope, query: TrainingQuery) {
  return orgScopedQueryOptions(scope.identity, {
    key: [TRAINING_RESOURCE, "list", query],
    queryFn: async ({ signal }) =>
      unwrap(await scope.client.GET("/api/v1/trainings/", { params: { query }, signal })),
  });
}
export function trainingVersionsOptions(scope: TrainingScope, query: { id: string; page: number }) {
  return orgScopedQueryOptions(scope.identity, {
    key: [TRAINING_RESOURCE, "versions", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/trainings/{id}/versions/", {
          params: {
            path: { id: query.id },
            query: { page: query.page, page_size: TRAINING_PAGE_SIZE },
          },
          signal,
        }),
      ),
  });
}
export function certificatesOptions(
  scope: TrainingScope,
  request: { subject: string; query: CertificateQuery },
) {
  return orgScopedQueryOptions(scope.identity, {
    key: [TRAINING_RESOURCE, "certificates", request],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/users/{subject_id}/trainings/", {
          params: { path: { subject_id: request.subject }, query: request.query },
          signal,
        }),
      ),
  });
}
export function eligibilityOptions(
  scope: TrainingScope,
  request: { subject: string; query: EligibilityQuery },
) {
  return orgScopedQueryOptions(scope.identity, {
    key: [TRAINING_RESOURCE, "eligibility", request],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/users/{subject_id}/eligibility/", {
          params: { path: { subject_id: request.subject }, query: request.query },
          signal,
        }),
      ),
  });
}
export function personEligibilityRequest(context: PersonContext) {
  return {
    subject: context.subject,
    query: {
      center: context.center,
      quadrant: context.quadrant || undefined,
      action: context.action,
      at: context.at || undefined,
    },
  };
}
export function requirementsOptions(
  scope: TrainingScope,
  query: { center: string; quadrant?: string | undefined; page: number },
) {
  return orgScopedQueryOptions(scope.identity, {
    key: [TRAINING_RESOURCE, "requirements", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await scope.client.GET("/api/v1/training-requirements/", {
          params: { query: { ...query, page_size: TRAINING_PAGE_SIZE } },
          signal,
        }),
      ),
  });
}
