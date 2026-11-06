import { useTranslation } from "react-i18next";
import { isBlockingError } from "./toast-context";
import type { ToastEntry } from "./toast-context";
import { ToastLiveRegion } from "./ToastLiveRegion";
import styles from "./ui.module.css";
interface ToastRegionsProps {
  toasts: readonly ToastEntry[];
  onDismiss: (id: number) => void;
}
export function ToastRegions({ toasts, onDismiss }: ToastRegionsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.toastRegions}>
      <ToastLiveRegion
        toasts={toasts.filter((toast) => !isBlockingError(toast))}
        onDismiss={onDismiss}
        label={t("ui.toast.label")}
        politeness="polite"
      />
      <ToastLiveRegion
        toasts={toasts.filter(isBlockingError)}
        onDismiss={onDismiss}
        label={t("ui.toast.blocking")}
        politeness="assertive"
      />
    </div>
  );
}
