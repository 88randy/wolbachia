import { useCompactViewport } from "./use-compact-viewport";
import type { ReactNode } from "react";
import styles from "./dialog-footer.module.css";
/** Equal controls on wide dialogs; stacked touch targets only on narrow viewports. */
export function DialogFooter({ children }: { children: ReactNode }) {
  const isCompact = useCompactViewport();
  return (
    <div className={styles.footer} data-compact={isCompact}>
      {children}
    </div>
  );
}
