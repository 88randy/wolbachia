import { useCallback, useState } from "react";
/** A new invocation resets search; typing into the shell transfers the first character. */
export function useCommandState() {
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const openPalette = useCallback(() => {
    setQuery("");
    setPaletteOpen(true);
  }, []);
  const openSearch = useCallback((next: string) => {
    setQuery(next);
    setPaletteOpen(true);
  }, []);
  const openHelp = useCallback(() => {
    setHelpOpen(true);
  }, []);
  return {
    isPaletteOpen,
    setPaletteOpen,
    isHelpOpen,
    setHelpOpen,
    query,
    setQuery,
    openPalette,
    openSearch,
    openHelp,
  };
}
