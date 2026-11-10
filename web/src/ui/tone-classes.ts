import type { Tone } from "./tone";

/** Background and text of each status tone. Status is never color alone: callers add icon + text. */
export const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-bg text-success-fg",
  warning: "bg-warning-bg text-warning-fg",
  critical: "bg-critical-bg text-critical-fg",
  info: "bg-info-bg text-info-fg",
  neutral: "bg-neutral-bg text-neutral-fg",
};

/** Soft border of each notice tone. */
export const TONE_BORDER: Record<Tone, string> = {
  success: "border-success-fg/25",
  warning: "border-warning-fg/25",
  critical: "border-critical-fg/25",
  info: "border-info-fg/20",
  neutral: "border-neutral-fg/15",
};
