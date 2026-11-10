import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { Review } from "./review-query";
import { ReviewState } from "./ReviewState";
import { ReviewMetadata } from "./ReviewMetadata";
import { ReviewSafety } from "./ReviewSafety";
import styles from "./reviews.module.css";

const SECONDS_PER_MINUTE = 60;

/** What the phone captured, in plain words: no payload, ids or raw coordinates. */
function OriginalFacts({ review }: { review: Review }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const event = review.original_event;
  const envelope = event.envelope;
  const skew = event.clock_skew_seconds;
  const accuracy = envelope.gps?.accuracy_m;
  return (
    <dl className={styles.facts}>
      {envelope.device_time && (
        <>
          <dt>{t("reviews.workspace.deviceTime")}</dt>
          <dd>{format(envelope.device_time)}</dd>
        </>
      )}
      {skew !== null && (
        <>
          <dt>{t("reviews.workspace.clockDifference")}</dt>
          <dd>
            {t("reviews.workspace.minutes", {
              count: Math.round(Math.abs(skew) / SECONDS_PER_MINUTE),
            })}
          </dd>
        </>
      )}
      <dt>{t("reviews.workspace.manualCapture")}</dt>
      <dd>{t(envelope.manual_capture ? "reviews.workspace.yes" : "reviews.workspace.no")}</dd>
      <dt>{t("reviews.workspace.phoneLocation")}</dt>
      <dd>
        {envelope.gps
          ? typeof accuracy === "number"
            ? t("reviews.workspace.accuracy", { meters: Math.round(accuracy) })
            : t("reviews.workspace.locationShared")
          : t("reviews.workspace.unavailable")}
      </dd>
    </dl>
  );
}

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
        <OriginalFacts review={review} />
      </details>
    </>
  );
}
