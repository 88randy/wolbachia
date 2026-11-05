import type { MessageKey } from "@wolbachia/i18n";

import type { BlockReason } from "./sync-failure.ts";
import type { SyncSnapshot } from "./sync-snapshot.ts";

export interface InboxNotice {
  readonly tone: "info" | "warning" | "critical";
  readonly messageKey: MessageKey;
}

const BLOCKED_NOTICE: Readonly<Record<BlockReason, InboxNotice>> = {
  needsLogin: { tone: "warning", messageKey: "mobile.blocked.needsLogin" },
  clockWrong: { tone: "critical", messageKey: "mobile.blocked.clockWrong" },
  noServer: { tone: "warning", messageKey: "mobile.blocked.noServer" },
  forbidden: { tone: "critical", messageKey: "mobile.blocked.forbidden" },
};

/**
 * The one message the inbox shows above the lists, or `null`: why sending is paused, else that
 * there is no signal, else that the app is waiting to retry. The words always say that nothing was lost.
 */
export function noticeFor(snapshot: SyncSnapshot): InboxNotice | null {
  if (snapshot.blockReason !== null) return BLOCKED_NOTICE[snapshot.blockReason];
  if (!snapshot.isOnline) return { tone: "warning", messageKey: "mobile.inbox.offline" };
  if (
    snapshot.phase === "waitingRetry" &&
    snapshot.lastFailureCode === "rejection_quota_exceeded"
  ) {
    return { tone: "info", messageKey: "mobile.inbox.rejectionQuota" };
  }
  if (snapshot.phase === "waitingRetry") {
    return { tone: "info", messageKey: "mobile.inbox.waitingRetry" };
  }
  return null;
}
