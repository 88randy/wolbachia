import type { ToastEntry } from "./toast-context";
import { ToastItem } from "./ToastItem";
import styles from "./ui.module.css";
interface ToastLiveRegionProps {
  toasts: readonly ToastEntry[];
  onDismiss: (id: number) => void;
  label: string;
  politeness: "polite" | "assertive";
}
export function ToastLiveRegion({ toasts, onDismiss, label, politeness }: ToastLiveRegionProps) {
  return (
    <div
      className={styles.toastList}
      aria-live={politeness}
      aria-relevant="additions removals"
      aria-label={label}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
