import { useState } from "react";
import { hasSeenAnnotationTips, rememberAnnotationTips } from "./annotation-preferences";

export function useAnnotationHelp(userId: string, onOpenChange: (open: boolean) => void) {
  const [isFirstUse, setFirstUse] = useState(() => !hasSeenAnnotationTips(userId));
  const changeOpen = (next: boolean) => {
    if (!next) {
      rememberAnnotationTips(userId);
      setFirstUse(false);
    }
    onOpenChange(next);
  };
  return { isFirstUse, changeOpen };
}
