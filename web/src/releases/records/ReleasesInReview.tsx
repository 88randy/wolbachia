import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { reviewListOptions } from "../../operations/reviews/review-query";
import { useCan } from "../../session/use-can";
import { useSessionIdentity } from "../../session/use-session-identity";
import { Card } from "../../ui/Card";
import { StatusPill } from "../../ui/StatusPill";

const REVIEW_READ = "review_item.read";
const RELEASE_EVENT = "release";
const MAX_ROWS = 100;

/**
 * Releases the phones sent that wait in the supervisor review queue. Each row's "En revisión"
 * pill opens the review screen. Hidden for users who cannot read the queue.
 */
export function ReleasesInReview() {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  const canRead = useCan()(REVIEW_READ);
  const scope = { client: useApiClient(), identity: useSessionIdentity() };
  const options = reviewListOptions(scope, { kind: "in_review", page_size: MAX_ROWS });
  const query = useQuery({ ...options, enabled: options.enabled && canRead });
  const rows = (query.data?.results ?? []).filter((row) => row.event_type.includes(RELEASE_EVENT));
  if (!canRead || rows.length === 0) return null;
  return (
    <Card title={t("releases.review.title", { count: rows.length })}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>{format(row.created_at)}</span>
            <Link to="/operations/reviews" aria-label={t("releases.review.open")}>
              <StatusPill tone="warning">{t("releases.status.inReview")}</StatusPill>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
