import type { ReactNode } from "react";
import { ShellFrame } from "./ShellFrame";
import { CommandProvider } from "./CommandProvider";
import type { CommandAction } from "./command-actions";
export function AppShell({
  children,
  actions,
}: { children?: ReactNode; actions?: readonly CommandAction[] } = {}) {
  return (
    <CommandProvider actions={actions}>
      <ShellFrame>{children}</ShellFrame>
    </CommandProvider>
  );
}
