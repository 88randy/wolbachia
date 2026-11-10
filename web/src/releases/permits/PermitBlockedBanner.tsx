import { useTranslation } from "react-i18next";
import { Banner } from "../../ui/Banner";
import { PermitBlockers } from "./PermitBlockers";
import { permitStatus } from "./permit-status";
import type { Permit } from "./permits-query";

/** Which condition blocks releases and who can resolve it; nothing when the permit is clear. */
export function PermitBlockedBanner({ blockers }: { blockers: Permit["blocked_by"] }) {
  const { t } = useTranslation();
  if (blockers.length === 0) return null;
  return (
    <Banner tone={permitStatus(blockers) === "suspended" ? "critical" : "warning"}>
      <strong>{t("permits.detail.blockedTitle")}</strong>
      <PermitBlockers blockers={blockers} />
    </Banner>
  );
}
