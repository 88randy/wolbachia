import type { ReactNode } from "react";
import { CommandContext, SearchCommandContext, HelpContext } from "./command-context";
import type { CommandAction } from "./command-actions";
import { ShellOverlays } from "./ShellOverlays";
import { useCommandShortcuts } from "./use-command-shortcuts";
import { useCommandState } from "./use-command-state";
interface CommandProviderProps {
  children: ReactNode;
  actions?: readonly CommandAction[];
}
export function CommandProvider({ children, actions }: CommandProviderProps) {
  const state = useCommandState();
  useCommandShortcuts(state.openPalette, state.openHelp);
  return (
    <CommandContext value={state.openPalette}>
      <SearchCommandContext value={state.openSearch}>
        <HelpContext value={state.openHelp}>
          {children}
          <ShellOverlays state={state} actions={actions} />
        </HelpContext>
      </SearchCommandContext>
    </CommandContext>
  );
}
