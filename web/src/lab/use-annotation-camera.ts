import { useSyncExternalStore } from "react";

const COARSE_POINTER = "(any-pointer: coarse)";

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(COARSE_POINTER);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function hasTouchInput() {
  return (
    navigator.maxTouchPoints > 0 ||
    (typeof window.matchMedia === "function" && window.matchMedia(COARSE_POINTER).matches)
  );
}

/** Only touch-capable devices offer the separate camera capture picker. */
export function useAnnotationCamera() {
  return useSyncExternalStore(subscribe, hasTouchInput);
}
