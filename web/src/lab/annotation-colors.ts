export const ANNOTATION_COLORS = {
  action: "var(--color-action)",
  success: "var(--color-status-success-fg)",
  critical: "var(--color-status-critical-fg)",
  warning: "var(--color-status-warning-fg)",
  neutral: "var(--color-status-neutral-fg)",
} as const;

export type AnnotationColor = keyof typeof ANNOTATION_COLORS;
