import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/**
 * Moves focus to a form's error summary when `failure` is set, so a keyboard or screen-reader
 * user lands on what went wrong. Attach the returned ref to the `FormAlert`.
 */
export function useFocusAlert(failure: unknown): RefObject<HTMLDivElement | null> {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (failure !== undefined) alertRef.current?.focus();
  }, [failure]);
  return alertRef;
}
