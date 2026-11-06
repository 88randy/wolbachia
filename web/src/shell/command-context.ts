import { createContext, useContext } from "react";
export const CommandContext = createContext<(() => void) | null>(null);
export const SearchCommandContext = createContext<((query: string) => void) | null>(null);
export const HelpContext = createContext<(() => void) | null>(null);
export function useOpenCommandPalette(): () => void {
  const open = useContext(CommandContext);
  if (!open) throw new Error("CommandProvider is required");
  return open;
}
export function useOpenSearchPalette(): (query: string) => void {
  const open = useContext(SearchCommandContext);
  if (!open) throw new Error("CommandProvider is required");
  return open;
}
export function useOpenShortcutsHelp(): () => void {
  const open = useContext(HelpContext);
  if (!open) throw new Error("CommandProvider is required");
  return open;
}
