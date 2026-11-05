import { useSyncExternalStore } from "react";
import { darkTheme, lightTheme } from "@wolbachia/tokens";
function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    observer.disconnect();
  };
}
function getTheme() {
  return document.documentElement.dataset["theme"] === "dark";
}
export function useMapTheme() {
  const isDark = useSyncExternalStore(subscribe, getTheme);
  return isDark ? darkTheme.color : lightTheme.color;
}
