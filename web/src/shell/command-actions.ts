export interface CommandAction {
  id: string;
  label: string;
  onSelect: () => void;
}
/** Punctuation shortcuts never interrupt editing in native or custom fields. */
export function isEditingText(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest(
        'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]',
      ) !== null)
  );
}
