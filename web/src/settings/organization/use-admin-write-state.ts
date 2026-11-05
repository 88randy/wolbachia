import { useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
export function useAdminWriteState() {
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  function reviewed() {
    setNeedsReview(false);
    setError(null);
  }
  return { isBusy, setBusy, error, setError, needsReview, setNeedsReview, reviewed };
}
export type AdminWriteState = ReturnType<typeof useAdminWriteState>;
