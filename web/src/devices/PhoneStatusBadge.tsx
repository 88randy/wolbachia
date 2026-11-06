import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
/** Active and revoked states retain their text and icon through the shared status treatment. */
export function PhoneStatusBadge({ isRevoked }: { isRevoked: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={isRevoked ? "critical" : "success"}>
      {t(isRevoked ? "phones.status.revoked" : "phones.status.active")}
    </StatusPill>
  );
}
