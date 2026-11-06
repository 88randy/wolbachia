import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import type { LoginNotice } from "../../auth/login-error.ts";
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
    "mobile.login.cleanupFailed",
  ].includes(key);
  return { tone: isCritical ? "critical" : "warning", icon: "alert" };
}

export function loginNotice(
  snapshot: Pick<AuthSnapshot, "notice" | "isOnline">,
  error: LoginNotice | null,
): LoginNotice | null {
  if (snapshot.notice?.key === "mobile.login.cleanupFailed") return snapshot.notice;
  if (error !== null) return error;
  if (snapshot.notice?.key === "mobile.login.sessionEnded") return snapshot.notice;
  return snapshot.isOnline ? snapshot.notice : { key: "mobile.login.noSignal" };
}
