import type { CommandAction } from "./command-actions";
import type { useCommandState } from "./use-command-state";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsHelp } from "./ShortcutsHelp";
interface ShellOverlaysProps {
  state: ReturnType<typeof useCommandState>;
  actions?: readonly CommandAction[];
}
/** Unmount immediately: an exit animation must not retain hideOthers or a focus scope. */
export function ShellOverlays({ state, actions }: ShellOverlaysProps) {
  return (
    <>
      {state.isPaletteOpen && (
        <CommandPalette
          open
          onOpenChange={state.setPaletteOpen}
          actions={actions}
          query={state.query}
          onQueryChange={state.setQuery}
        />
      )}
      {state.isHelpOpen && <ShortcutsHelp open onOpenChange={state.setHelpOpen} />}
    </>
  );
}
