import type { MessageKey } from "@wolbachia/i18n";
import { deliveryState } from "./domain.ts";
export function reviewLabel(review: ReturnType<typeof deliveryState>["review"]): MessageKey {
  if (review === "accepted") return "mobile.lifecycle.reviewAccepted";
  if (review === "rejected") return "mobile.lifecycle.reviewRejected";
  return review === "in_review" ? "mobile.ovitrap.reviewPending" : "mobile.ovitrap.reviewUnknown";
}
