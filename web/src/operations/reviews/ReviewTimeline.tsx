import { useTranslation } from "react-i18next";
import type { Review } from "./review-query";
import { ReviewDecisionEntry } from "./ReviewDecisionEntry";
export function ReviewTimeline({ review }: { review: Review }) {
  const { t } = useTranslation();
  return (
    <section aria-label={t("reviews.workspace.history")}>
      <h3>{t("reviews.workspace.history")}</h3>
      <ol>
        {review.timeline.map((decision) => (
          <ReviewDecisionEntry key={decision.id} decision={decision} />
        ))}
      </ol>
      {review.timeline.length === 0 && <p>{t("reviews.workspace.noDecisions")}</p>}
    </section>
  );
}
