import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

type Review = Schemas["ReviewHistoryEntry"];
function outcomeKey(review: Review): MessageKey | null {
  if (review.kind !== "review_decision") return null;
  if (
    review.decision_kind === "accept" &&
    ["applied_review", "adopted_legacy"].includes(review.effect_state)
  )
    return "mobile.fuel.reviewedAccepted";
  if (review.decision_kind === "void" && review.effect_state === "discarded")
    return "mobile.fuel.reviewedVoided";
  return review.decision_kind === "open_incident" &&
    review.effect_state === "incident_open" &&
    review.incident_id
    ? "mobile.fuel.incidentOpen"
    : null;
}

export function FuelReviewOutcome({ review }: { readonly review: Review | null }) {
  const t = useT();
  const key = review === null ? null : outcomeKey(review);
  if (key === null || review === null) return null;
  return <InfoNotice tone="info" message={review.reason ? `${t(key)} ${review.reason}` : t(key)} />;
}
