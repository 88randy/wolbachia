import type { OutboxStatus } from "../../outbox/outbox-status.ts";
import type { StatusTone } from "../../ui/StatusCard.tsx";
import { STATUS_PRESENTATION } from "../../ui/status-presentation.ts";

const BY_BADGE_TONE: Readonly<Record<string, StatusTone>> = {
  success: "success",
  warning: "warning",
  critical: "danger",
  info: "info",
  neutral: "info",
};

/** Maps the sync status to the kit's status tone (the icon and words come from StatusCard). */
export function statusTone(status: OutboxStatus): StatusTone {
  return BY_BADGE_TONE[STATUS_PRESENTATION[status].tone] ?? "info";
}
