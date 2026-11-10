import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../../components/templates/DetailPage";
import { PermitActions } from "./PermitActions";
import { PermitBlockedBanner } from "./PermitBlockedBanner";
import { PermitFacts } from "./PermitFacts";
import { permitStatus } from "./permit-status";
import { PermitStatusBadge } from "./PermitStatusBadge";
import { PermitSuspension } from "./PermitSuspension";
import { PermitZone } from "./PermitZone";
import type { Permit } from "./permits-query";

/** W45 body: identity and status, blockers, facts, official zone and the suspension, if any. */
export function PermitRecord({ permit }: { permit: Permit }) {
  const { t } = useTranslation();
  const version = permit.current_version;
  return (
    <DetailPage
      title={permit.code}
      status={<PermitStatusBadge status={permitStatus(permit.blocked_by)} />}
      actions={<PermitActions permit={permit} />}
      notices={<PermitBlockedBanner blockers={permit.blocked_by} />}
    >
      <Link to="/releases/permits" className="text-sm font-semibold text-action-strong">
        {t("permits.detail.back")}
      </Link>
      {version ? (
        <PermitFacts permit={permit} version={version} />
      ) : (
        <p>{t("permits.detail.noVersion")}</p>
      )}
      <PermitZone geometry={version?.geometry} />
      {permit.suspension && <PermitSuspension suspension={permit.suspension} />}
    </DetailPage>
  );
}
