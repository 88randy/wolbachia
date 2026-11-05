import type { OutboxStatus } from "../outbox/outbox-status.ts";
import type { BadgeTone } from "./Badge.tsx";
import type { IconName } from "./icon-paths.ts";

interface StatusPresentation {
  readonly tone: BadgeTone;
  readonly icon: IconName;
}

/** Tone and icon of each outbox status (design P28 badges). */
export const STATUS_PRESENTATION: Readonly<Record<OutboxStatus, StatusPresentation>> = {
  pending: { tone: "neutral", icon: "phone" },
  sending: { tone: "info", icon: "cloudUp" },
  sent: { tone: "success", icon: "cloudOk" },
  error: { tone: "critical", icon: "alert" },
  in_review: { tone: "info", icon: "search" },
  rejected: { tone: "critical", icon: "ban" },
};
