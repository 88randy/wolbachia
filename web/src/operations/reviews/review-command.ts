import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { Review, ReviewAction } from "./review-query";

/** Current /me grants are hints; only a fresh matching server evaluation can enable acceptance. */
export function canReview(review: Review, action: ReviewAction): boolean {
  if (review.decision_state.terminal) return false;
  if (action === "accept") return review.evaluation.can_accept;
  return true;
}

export interface ReviewCommand {
  id: string;
  action: ReviewAction;
  body: Schemas["ReviewDecisionRequestRequest"];
  signal: AbortSignal;
}

/** One frozen revision/reason is issued exactly once. Nothing retries or changes ingest history. */
export function sendReview(client: ApiClient, command: ReviewCommand) {
  const options = {
    params: { path: { id: command.id } },
    body: command.body,
    signal: command.signal,
  };
  switch (command.action) {
    case "accept":
      return client.POST("/api/v1/review-items/{id}/accept/", options);
    case "void":
      return client.POST("/api/v1/review-items/{id}/void/", options);
    case "open_incident":
      return client.POST("/api/v1/review-items/{id}/open-incident/", options);
  }
}
