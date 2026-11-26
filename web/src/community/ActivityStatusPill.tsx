import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";

/** Active or voided: color + icon + text. */
export function ActivityStatusPill({ isVoided }: { isVoided: boolean }) {
  const { t } = useTranslation();
  return isVoided ? (
    <StatusPill tone="neutral">{t("community.status.voided")}</StatusPill>
  ) : (
    <StatusPill tone="success">{t("community.status.active")}</StatusPill>
  );
}
