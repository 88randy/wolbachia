import { useEffect } from "react";
import { isEditingText } from "./command-actions";
function isCommandShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "k";
}
function isHelpShortcut(event: KeyboardEvent): boolean {
  return event.key === "?" && !event.ctrlKey && !event.metaKey && !isEditingText(event.target);
}
function hasOpenDialog(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}
export function useCommandShortcuts(openPalette: () => void, openHelp: () => void): void {
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.isComposing) return;
      if (isCommandShortcut(event)) {
        event.preventDefault();
        openPalette();
        return;
      }
      if (!isHelpShortcut(event) || hasOpenDialog()) return;
      event.preventDefault();
      openHelp();
    }
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
    };
  }, [openPalette, openHelp]);
}
