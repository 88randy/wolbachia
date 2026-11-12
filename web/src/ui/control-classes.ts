/**
 * One control look for every picker-style button (Combobox, DateField, option and range pickers)
 * and the toolbar fields: 40 px (`--web-control-lg`), 12 px radius, one border, 14 px text.
 * Text inputs get the same numbers from `styles/global.css` and `forms/form.module.css`; Button
 * `md` is 40 px too, so a button beside a field lines up exactly.
 */
export const CONTROL_BOX =
  "h-[var(--web-control-lg)] min-h-[var(--web-control-lg)] w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink shadow-xs";

/** Picker-style trigger button: the control box plus layout, hover and disabled state. */
export const CONTROL_TRIGGER = `${CONTROL_BOX} inline-flex items-center gap-2 text-left hover:border-ink-3 disabled:cursor-not-allowed disabled:opacity-60`;

/** The label of a field: 12 px bold, 20 px line, same as `forms/TextField`. */
export const FIELD_LABEL_CLASS = "text-xs leading-5 font-bold text-ink";

/** Vertical stack of label, control and notes: one 4 px gap everywhere. */
export const FIELD_STACK_CLASS = "flex min-w-0 flex-col gap-1";
