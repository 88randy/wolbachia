import { useTranslation } from "react-i18next";
import type { Review } from "./review-query";
import { ReviewState } from "./ReviewState";
import { ReviewMetadata } from "./ReviewMetadata";
import { ReviewSafety } from "./ReviewSafety";
import styles from "./reviews.module.css";
export function ReviewFacts({ review }: { review: Review }) {
  const { t } = useTranslation();
  return (
    <>
      <dl className={styles.facts}>
        <ReviewState review={review} />
        <ReviewMetadata review={review} />
      </dl>
      <ReviewSafety review={review} />
      <details>
        <summary>{t("reviews.workspace.original")}</summary>
        <pre className={styles.snapshot}>{JSON.stringify(review.original_event, null, 2)}</pre>
      </details>
    </>
  );
}
