import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
/** A missing configured value is a warning, never a numeric zero. */
export function NotConfiguredBadge() {
  const { t } = useTranslation();
  return <StatusPill tone="warning">{t("rules.status.notConfigured")}</StatusPill>;
}
