import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

function useUnsavedBeforeUnload(isDirty: boolean, isSaved: RefObject<boolean>) {
  useEffect(() => {
    if (!isDirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (isSaved.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [isDirty, isSaved]);
}

/** One router blocker covers shell links, editor actions and history traversal. */
export function useAnnotationNavigation(hasWork: boolean) {
  const saved = useRef(false);
  const [isSaved, setSaved] = useState(false);
  const isDirty = hasWork && !isSaved;
  const shouldBlockFn = useCallback(() => hasWork && !saved.current, [hasWork]);
  const blocker = useBlocker({
    shouldBlockFn,
    withResolver: true,
    disabled: !isDirty,
    enableBeforeUnload: false,
  });
  useUnsavedBeforeUnload(isDirty, saved);
  const markSaved = () => {
    // The save callback navigates before React necessarily commits its state update.
    saved.current = true;
    setSaved(true);
  };
  return { blocker, markSaved };
}
