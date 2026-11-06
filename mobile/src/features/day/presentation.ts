import type { MessageKey } from "@wolbachia/i18n";
import type { BadgeTone } from "../../ui/Badge.tsx";
import type { IconName } from "../../ui/icon-paths.ts";
import type { DayTask } from "./domain.ts";
export interface MarkerState {
  readonly tone: BadgeTone;
  readonly icon: IconName;
  readonly key: MessageKey;
}
/** Native markers and list badges use the same icon/text state so color never carries meaning alone. */
export function markerState(row: DayTask): MarkerState {
  if (row.isReviewed) return { tone: "success", icon: "check", key: "mobile.day.doneStatus" };
  if (row.task.action === "relocate")
    return { tone: "neutral", icon: "move", key: "mobile.day.relocateStatus" };
  return { tone: "info", icon: "clock", key: "mobile.day.pendingStatus" };
}
export const ACTION_KEYS: Readonly<Record<DayTask["task"]["action"], MessageKey>> = {
  place: "mobile.day.place",
  check: "mobile.day.check",
  replace: "mobile.day.replace",
  relocate: "mobile.day.relocate",
  remove: "mobile.day.remove",
};
/** [ASSUMPTION] Fixture summary codes until the history producer publishes its vocabulary. */
export const HISTORY_KEYS: Readonly<Record<string, MessageKey>> = {
  ok: "mobile.day.historyOk",
  dry: "mobile.day.historyDry",
};
