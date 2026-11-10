import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import { STATUS_TONE } from "./permit-status";
import type { PermitStatus } from "./permit-status";

/** Status is color + icon + text (the pill carries all three). */
export function PermitStatusBadge({ status }: { status: PermitStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={STATUS_TONE[status]}>{t(`permits.status.${status}`)}</StatusPill>;
}
