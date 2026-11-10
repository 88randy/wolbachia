import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import type { Review } from "./review-query";
export function ReviewSafety({ review }: { review: Review }) {
  const { t } = useTranslation();
  return (
    <>
      <InlineNotice tone="info">{t("reviews.workspace.immutable")}</InlineNotice>
      {!review.evaluation.can_accept && (
        <InlineNotice tone="warning">{t("reviews.workspace.safety")}</InlineNotice>
      )}
      <ul>
        {review.evaluation.blockers.map((blocker) => (
          <li key={blocker}>{t("reviews.workspace.blocker", { code: blocker })}</li>
        ))}
      </ul>
    </>
  );
}
