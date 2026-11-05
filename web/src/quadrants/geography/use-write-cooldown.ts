import { useRef, useState } from "react";
import type { WriteOutcome } from "./write-result";
/** Editing a failed draft cannot bypass the server's Retry-After window. */
export function useWriteCooldown() {
  const deadline = useRef(0);
  const [retryAt, setRetryAt] = useState(0);
  const receive = (result: WriteOutcome<unknown>) => {
    if (result.kind !== "failed") return;
    deadline.current = Math.max(deadline.current, result.retryAt);
    setRetryAt(deadline.current);
  };
  return { retryAt, receive, canStart: () => Date.now() >= deadline.current };
}
