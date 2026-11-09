import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { Review } from "./review-query";
export function ReviewMetadata({ review }: { review: Review }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <>
      <dt>{t("reviews.workspace.cause")}</dt>
      <dd>{review.code}</dd>
      <dt>{t("reviews.workspace.courier")}</dt>
      <dd>{review.courier}</dd>
      <dt>{t("reviews.workspace.received")}</dt>
      <dd>{format(review.original_event.server_received_at)}</dd>
    </>
  );
}
