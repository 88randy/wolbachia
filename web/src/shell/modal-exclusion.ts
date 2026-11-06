import { isShellSessionAvailable } from "./shell-session";
const OPEN_MODAL_SELECTOR = [
  "dialog[open]",
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[aria-modal="true"]:not(dialog):not([hidden]):not([data-state="closed"])',
].join(", ");
/** Native top-layer dialogs and Radix/ARIA modals all exclude shell overlays. */
export function hasOpenModal(): boolean {
  return document.querySelector(OPEN_MODAL_SELECTOR) !== null;
}
/** The shared gate for shortcuts, search typing, clicks and controlled opening. */
export function canOpenShellOverlay(): boolean {
  return isShellSessionAvailable() && !hasOpenModal();
}
