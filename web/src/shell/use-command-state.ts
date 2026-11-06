import { useCallback, useState } from "react";
import { useShellOverlay } from "./use-shell-overlay";
/** A permitted invocation resets search or transfers the first typed character. */
function useCommandSearch(open: ReturnType<typeof useShellOverlay>["open"]) {
  const [query, setQuery] = useState("");
  const openSearch = useCallback(
    (next: string) => {
      if (open("palette")) setQuery(next);
    },
    [open],
  );
  const openPalette = useCallback(() => {
    openSearch("");
  }, [openSearch]);
  return { query, setQuery, openSearch, openPalette };
}
export function useCommandState() {
  const { overlay, open, setOpen } = useShellOverlay();
  const search = useCommandSearch(open);
  const openHelp = useCallback(() => {
    open("help");
  }, [open]);
  return {
    ...search,
    isPaletteOpen: overlay === "palette",
    isHelpOpen: overlay === "help",
    setPaletteOpen: (next: boolean) => {
      setOpen("palette", next);
    },
    setHelpOpen: (next: boolean) => {
      setOpen("help", next);
    },
    openHelp,
  };
}
