import type { Motorcycle } from "./fleet-query";
import { MotorcycleReasonDialog } from "./MotorcycleReasonDialog";
import { UnblockDialog } from "./UnblockDialog";
import type { useMotorcycleActions } from "./use-motorcycle-actions";

/** Unblock and void dialogs; the buttons live in the header menu. */
export function MotorcycleActionDialogs({
  motorcycle,
  actions,
}: {
  motorcycle: Motorcycle;
  actions: ReturnType<typeof useMotorcycleActions>;
}) {
  const ReasonDialog = actions.action === "unblock" ? UnblockDialog : MotorcycleReasonDialog;
  if (actions.action === undefined || !actions.hasPermission) return null;
  return <ReasonDialog motorcycle={motorcycle} onDone={actions.done} onCancel={actions.close} />;
}
