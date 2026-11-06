import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ToastContext } from "./toast-context";
import type { ToastEntry, ToastOptions } from "./toast-context";
import { ToastRegions } from "./ToastRegions";
export { useToast } from "./toast-context";
const MAX_VISIBLE_TOASTS = 3;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const showToast = useCallback((options: ToastOptions) => {
    const entry = { ...options, id: nextId.current++ };
    setToasts((current) => [...current, entry]);
  }, []);
  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegions toasts={toasts.slice(0, MAX_VISIBLE_TOASTS)} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}
