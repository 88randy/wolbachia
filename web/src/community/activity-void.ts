import { voidInfoOf } from "../void";
import type { VoidInfo } from "../void";
import type { CommunityActivity } from "./community-query";

interface Display {
  author: (userId: string | null) => string;
  formatWhen: (iso: string) => string;
  reasonLabel: (code: string) => string;
}

/** The void facts of a voided activity come from its `void` event; `null` while it is active. */
export function activityVoidInfo(row: CommunityActivity, display: Display): VoidInfo | null {
  const event = row.events.find((entry) => entry.action === "void");
  if (!row.is_voided || event === undefined) return null;
  return voidInfoOf(
    {
      voided_at: event.server_received_at,
      voided_by: event.created_by,
      void_reason_code: event.reason_code,
      void_reason: event.reason,
    },
    display.author,
    { formatWhen: display.formatWhen, reasonLabel: display.reasonLabel },
  );
}
