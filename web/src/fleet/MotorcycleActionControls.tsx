import { MotorcycleActionButton } from "./MotorcycleActionButton";
import type { useMotorcycleActions } from "./use-motorcycle-actions";
import styles from "./fleet.module.css";
export function MotorcycleActionControls({
  actions,
}: {
  actions: ReturnType<typeof useMotorcycleActions>;
}) {
  return (
    <div className={styles.actions}>
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
