import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";

export function OrganizationStatus({ isActive }: { isActive: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={isActive ? "success" : "warning"}>
      {t(isActive ? "platform.status.active" : "platform.status.suspended")}
    </StatusPill>
  );
}
