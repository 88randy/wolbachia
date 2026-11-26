import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../../components/templates/DetailPage";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { Card } from "../../ui/Card";
import { PermitBlockers } from "../permits/PermitBlockers";
import { releasePoint } from "./release-status";
import { ReleaseFacts } from "./ReleaseFacts";
import { ReleasePointMap } from "./ReleasePointMap";
import { ReleaseStatusPill } from "./ReleaseStatusPill";
import type { Release } from "./releases-query";

/** A loaded release: summary, why it is in review (if so) and its point on the map. */
export function ReleaseDetail({ release }: { release: Release }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  return (
    <DetailPage
      title={t("releases.detail.title", { when: format(release.device_time) })}
      status={<ReleaseStatusPill row={release} />}
      actions={
        <Link to="/releases/records" className="text-sm font-semibold text-action-strong">
          {t("releases.detail.back")}
        </Link>
      }
    >
      <Card title={t("releases.detail.summary")}>
        <ReleaseFacts release={release} />
      </Card>
      {release.blocked_by.length > 0 && (
        <Card title={t("releases.detail.blockers")}>
          <PermitBlockers blockers={release.blocked_by} />
        </Card>
      )}
      <Card title={t("releases.detail.point")}>
        <ReleasePointMap point={releasePoint(release)} />
      </Card>
    </DetailPage>
  );
}
