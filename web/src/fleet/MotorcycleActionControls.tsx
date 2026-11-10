import { MotorcycleActionButton } from "./MotorcycleActionButton";
import type { useMotorcycleActions } from "./use-motorcycle-actions";
export function MotorcycleActionControls({
  actions,
}: {
  actions: ReturnType<typeof useMotorcycleActions>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.canUnblock && (
        <MotorcycleActionButton
          label="fleet.unblock.confirm"
          reason={actions.unblockReason}
          onClick={actions.openUnblock}
        />
      )}
      {actions.canVoid && (
        <MotorcycleActionButton
          label="common.actions.void"
          reason={actions.reason}
          onClick={actions.openVoid}
        />
      )}
    </div>
  );
}
