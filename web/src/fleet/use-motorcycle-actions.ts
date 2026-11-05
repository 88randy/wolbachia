import { useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useCan } from "../session/use-can";
import type { Motorcycle } from "./fleet-query";
import { MOTORCYCLE_MANAGE, MOTORCYCLE_UNBLOCK } from "./permissions";
import type { MotorcycleAction } from "./use-motorcycle-action";
function blockedActionReason(
  motorcycle: Motorcycle,
  isUnverified: boolean,
): MessageKey | undefined {
  if (isUnverified) return "fleet.record.refreshRequired";
  return motorcycle.voided_at === null ? undefined : "fleet.action.voided";
}
/** Permission hides an action; state disables it with a visible explanation. */
export function useMotorcycleActions(motorcycle: Motorcycle, isUnverified: boolean) {
  const [action, setAction] = useState<MotorcycleAction>();
  const [hasSucceeded, setSucceeded] = useState(false);
  const reason = blockedActionReason(motorcycle, isUnverified);
  const canVoid = useCan()(MOTORCYCLE_MANAGE);
  const canUnblock = useCan()(MOTORCYCLE_UNBLOCK);
  return {
    action,
    hasSucceeded,
    reason,
    canVoid,
    canUnblock,
    unblockReason:
      reason ?? (motorcycle.is_blocked ? undefined : ("fleet.action.notBlocked" as const)),
    hasPermission: action === "void" ? canVoid : canUnblock,
    openVoid: () => {
      setAction("void");
    },
    openUnblock: () => {
      setAction("unblock");
    },
    close: () => {
      setAction(undefined);
    },
    done: () => {
      setAction(undefined);
      setSucceeded(true);
    },
  };
}
