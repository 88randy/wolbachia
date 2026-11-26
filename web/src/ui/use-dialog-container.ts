import { useCallback, useState } from "react";

/**
 * A native <dialog> sits in the browser top layer, so a floating list portaled to <body> would
 * render behind it. This returns the enclosing <dialog> (or null) and the ref for the trigger.
 */
export function useDialogContainer() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const ref = useCallback((element: HTMLElement | null) => {
    if (element) setContainer(element.closest("dialog"));
  }, []);
  return [container, ref] as const;
}
