import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import type { Review } from "./review-query";
import { reviewKindKey, reviewStateKey } from "./review-labels";
export function ReviewState({ review }: { review: Review }) {
  const { t } = useTranslation();
  return (
    <>
      <dt>{t("reviews.workspace.ingest")}</dt>
      <dd>
        <StatusPill tone="warning">{t(reviewKindKey(review.kind))}</StatusPill>
      </dd>
      <dt>{t("reviews.workspace.current")}</dt>
      <dd>
        <StatusPill tone="neutral">{t(reviewStateKey(review.decision_state.kind))}</StatusPill>
      </dd>
    </>
  );
}
