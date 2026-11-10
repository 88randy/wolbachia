import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { useCouriers } from "../../scheduling/use-directories";
import { reviewEventKey } from "./review-event-label";
import type { Review } from "./review-query";
export function ReviewMetadata({ review }: { review: Review }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const courierName = useCouriers([]).nameOf;
  return (
    <>
      <dt>{t("reviews.workspace.cause")}</dt>
      <dd>{review.code}</dd>
      <dt>{t("reviews.workspace.event")}</dt>
      <dd>{t(reviewEventKey(review.event_type))}</dd>
      <dt>{t("reviews.workspace.courierName")}</dt>
      <dd>{courierName(review.courier)}</dd>
      <dt>{t("reviews.workspace.received")}</dt>
      <dd>{format(review.original_event.server_received_at)}</dd>
    </>
  );
}
