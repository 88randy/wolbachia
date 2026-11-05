import type { MessageKey } from "@wolbachia/i18n";

import type { IconName } from "../../ui/icon-paths.ts";
import type { NoticeTone } from "../../ui/Notice.tsx";

export function authNoticePresentation(key: MessageKey): { tone: NoticeTone; icon: IconName } {
  if (key === "mobile.login.sessionEnded") return { tone: "info", icon: "shield" };
  if (key === "mobile.login.noSignal") return { tone: "warning", icon: "noSignal" };
  const isCritical = [
    "mobile.login.wrongCredentials",
    "mobile.unlock.wrongSecret",
    "mobile.login.deviceRevoked",
    "mobile.storage.actionFailed",
  ].includes(key);
  return { tone: isCritical ? "critical" : "warning", icon: "alert" };
}
