import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";
import { ToneIcon } from "./ToneIcon";
import { useToastItem } from "./use-toast-item";
import type { ToastEntry } from "./toast-context";
import styles from "./ui.module.css";
interface ToastItemProps {
  toast: ToastEntry;
  onDismiss: (id: number) => void;
}
export function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { t } = useTranslation();
  const { expire, runAction, events } = useToastItem(toast, onDismiss);
  return (
    <div className={styles.toast} {...events}>
      <ToneIcon tone={toast.tone ?? "info"} />
      <span className={styles.toastMessage}>{toast.message}</span>
      {toast.action !== undefined && (
        <Button variant="secondary" size="sm" onClick={runAction}>
          {toast.action.label}
        </Button>
      )}
      <Button variant="ghost" size="sm" aria-label={t("ui.actions.dismiss")} onClick={expire}>
        <X aria-hidden="true" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
