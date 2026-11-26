import { useRef, useState } from "react";
import { hasSeenAnnotationTips, rememberAnnotationTips } from "./annotation-preferences";

export function useAnnotationHelp(userId: string, onOpenChange: (open: boolean) => void) {
  const [isFirstUse, setFirstUse] = useState(() => !hasSeenAnnotationTips(userId));
  const [step, setStep] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const shortcutsTrigger = useRef<HTMLButtonElement>(null);
  const restoreShortcutsFocus = (event: Event) => {
    event.preventDefault();
    shortcutsTrigger.current?.focus();
  };
  const changeOpen = (next: boolean) => {
    if (!next) {
      rememberAnnotationTips(userId);
      setFirstUse(false);
    }
    onOpenChange(next);
  };
  return {
    isFirstUse,
    changeOpen,
    step,
    setStep,
    shortcutsOpen,
    setShortcutsOpen,
    shortcutsTrigger,
    restoreShortcutsFocus,
  };
}
