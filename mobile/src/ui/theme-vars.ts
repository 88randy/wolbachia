import type { Theme } from "@wolbachia/tokens";
import { vars } from "nativewind";

/**
 * Maps the active packages/tokens theme to the CSS variables that tailwind.config.js reads, so every
 * `className` color follows light/dark without a hex literal in the app.
 */
export function themeVars(theme: Theme) {
  const c = theme.color;
  return vars({
    "--color-action": c.action,
    "--color-action-strong": c.actionStrong,
    "--color-on-action": c.onAction,
    "--color-navy": c.navy,
    "--color-tint": c.tint,
    "--color-bg": c.background,
    "--color-surface": c.surface,
    "--color-surface-muted": c.surfaceMuted,
    "--color-ink": c.text.primary,
    "--color-ink-2": c.text.secondary,
    "--color-ink-3": c.text.tertiary,
    "--color-line": c.border.soft,
    "--color-line-strong": c.border.default,
    "--color-success": c.status.success.fg,
    "--color-success-bg": c.status.success.bg,
    "--color-warning": c.status.warning.fg,
    "--color-warning-bg": c.status.warning.bg,
    "--color-danger": c.status.critical.fg,
    "--color-danger-bg": c.status.critical.bg,
    "--color-info": c.status.info.fg,
    "--color-info-bg": c.status.info.bg,
    "--color-neutral": c.status.neutral.fg,
    "--color-neutral-bg": c.status.neutral.bg,
  });
}
