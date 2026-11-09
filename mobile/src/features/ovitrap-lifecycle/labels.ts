import type { MessageKey } from "@wolbachia/i18n";
import type { LifecycleKind, RecoveryState, RelocationProposal } from "./types.ts";
export const KIND_LABEL: Record<LifecycleKind, MessageKey> = {
  replace: "mobile.lifecycle.replace",
  relocate: "mobile.lifecycle.relocate",
  remove: "mobile.lifecycle.remove",
};
export const RECOVERY_LABEL: Record<RecoveryState, MessageKey> = {
  recovered: "mobile.lifecycle.recovered",
  unrecovered: "mobile.lifecycle.unrecovered",
  unconfirmed: "mobile.lifecycle.unconfirmed",
};
export const PROPOSAL_LABEL: Record<RelocationProposal["status"], MessageKey> = {
  proposed: "mobile.lifecycle.proposed",
  approved: "mobile.lifecycle.approved",
  rejected: "mobile.lifecycle.rejected",
};
