import { useState } from "react";
import type { Profile, Membership } from "./use-w-03";
/** Reading a newer revision never adopts it until the user explicitly reviews the snapshot. */
export function useScopeRevision(initial: number, onReviewed: () => void) {
  const [revision, setRevision] = useState(initial);
  const [current, setCurrent] = useState<Profile | Membership | null>(null);
  function review() {
    if (current) {
      setRevision(current.revision);
      onReviewed();
      setCurrent(null);
    }
  }
  return { revision, current, setCurrent, review };
}
