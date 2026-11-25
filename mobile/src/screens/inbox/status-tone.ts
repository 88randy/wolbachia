import type { OutboxStatus } from "../../outbox/outbox-status.ts";
import type { BadgeTone } from "../../ui/Badge.tsx";
import type { StatusTone } from "../../ui/StatusCard.tsx";
import { STATUS_PRESENTATION } from "../../ui/status-presentation.ts";
import type { StatusPresentation } from "../../ui/status-presentation.ts";

const BY_BADGE_TONE: Readonly<Record<BadgeTone, StatusTone>> = {
  success: "success",
  warning: "warning",
  critical: "danger",
  info: "info",
  neutral: "neutral",
};

/** P28 card props of a sync status from the shared table (D4, #373): tone, icon and words. */
export function statusCardOf(
  status: OutboxStatus,
): Pick<StatusPresentation, "icon" | "label"> & { readonly tone: StatusTone } {
  const presentation = STATUS_PRESENTATION[status];
  return { ...presentation, tone: BY_BADGE_TONE[presentation.tone] };
}
