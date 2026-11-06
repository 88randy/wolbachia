import { useLayoutEffect, useRef } from "react";
import { MAIN_ID } from "./ids";
/** A disappearing compact-only control must not leave keyboard focus on the document body. */
export function useFocusMainOnUnmount() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    return () => {
      if (document.activeElement === element) document.getElementById(MAIN_ID)?.focus();
    };
  }, []);
  return ref;
}
