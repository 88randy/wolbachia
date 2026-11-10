/** Shared overlay surfaces (dialogs, sheets, confirmations), aligned with shadcn/ui. */
export const OVERLAY_CLASS =
  "fixed inset-0 z-[80] bg-[var(--web-overlay-backdrop)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none";

export const DIALOG_CLASS =
  "fixed top-1/2 left-1/2 z-[81] flex max-h-[calc(100dvh-2rem)] w-[min(calc(100vw-2rem),30rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-auto rounded-2xl border border-line bg-popover p-6 text-ink shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none";

export const SHEET_CLASS =
  "fixed inset-y-2 right-2 z-[81] flex w-[min(calc(100vw-1rem),27rem)] flex-col gap-4 overflow-auto rounded-2xl border border-line bg-popover p-6 text-ink shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right-10 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-10 motion-reduce:animate-none";

export const DIALOG_TITLE_CLASS = "m-0 text-base leading-6 font-semibold tracking-tight";

export const DIALOG_DESCRIPTION_CLASS = "m-0 text-[13px] leading-5 text-ink-2";
