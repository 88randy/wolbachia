import { createContext, useContext } from "react";
import type { Tone } from "./tone";
export interface ToastOptions {
  message: string;
  tone?: Tone;
  action?: { label: string; onAction: () => void };
  isBlocking?: boolean;
}
export interface ToastEntry extends ToastOptions {
  id: number;
}
export interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: number) => void;
}
export const ToastContext = createContext<ToastContextValue | null>(null);
/** Transient feedback belongs to the nearest app-level provider, never to browser dialogs. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) throw new Error("useToast requires ToastProvider");
  return context;
}

/** Interruptive announcements are reserved for errors that block an action. */
export function isBlockingError(toast: ToastOptions): boolean {
  return toast.tone === "critical" && toast.isBlocking === true;
}
