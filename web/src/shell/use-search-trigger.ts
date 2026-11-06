import type { KeyboardEvent } from "react";
import { useOpenCommandPalette, useOpenSearchPalette } from "./command-context";
/** Search is an invocation field: forward printable typing rather than silently discard it. */
export function useSearchTrigger() {
  const open = useOpenCommandPalette();
  const openSearch = useOpenSearchPalette();
  return (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      open();
      return;
    }
    if (event.key.length !== 1) return;
    event.preventDefault();
    openSearch(event.key);
  };
}
