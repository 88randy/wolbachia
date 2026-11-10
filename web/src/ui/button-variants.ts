import { cva } from "class-variance-authority";

/** One button look for the whole app: brand `action` color, 12 px radius, token control heights. */
export const buttonVariants = cva(
  [
    "relative inline-flex max-w-full min-w-0 items-center justify-center gap-2 self-start justify-self-start rounded-lg border border-transparent",
    "px-4 text-[13px] leading-5 font-semibold whitespace-normal no-underline [overflow-wrap:break-word]",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out select-none",
    "active:not-disabled:not-aria-disabled:translate-y-px",
    "disabled:cursor-not-allowed disabled:bg-[var(--color-disabled-background)] disabled:text-ink-2 disabled:shadow-none",
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-action text-on-action shadow-xs hover:not-disabled:not-aria-disabled:bg-[var(--web-button-primary-hover)] active:not-disabled:not-aria-disabled:bg-[var(--web-button-primary-pressed)]",
        secondary:
          "bg-tint text-action-strong hover:not-disabled:not-aria-disabled:bg-[var(--web-button-secondary-hover)] active:not-disabled:not-aria-disabled:bg-[var(--web-button-secondary-pressed)]",
        tertiary:
          "border-line-strong bg-surface text-ink shadow-xs hover:not-disabled:not-aria-disabled:bg-[var(--web-button-tertiary-hover)] active:not-disabled:not-aria-disabled:bg-[var(--web-button-tertiary-pressed)]",
        ghost:
          "bg-transparent text-ink-2 hover:not-disabled:not-aria-disabled:bg-[var(--web-button-ghost-hover)] hover:not-disabled:not-aria-disabled:text-ink active:not-disabled:not-aria-disabled:bg-[var(--web-button-ghost-pressed)]",
        destructive:
          "border-critical-fg bg-critical-bg text-critical-fg hover:not-disabled:not-aria-disabled:bg-[var(--web-button-destructive-tint-hover)] active:not-disabled:not-aria-disabled:bg-[var(--web-button-destructive-tint-pressed)]",
      },
      size: {
        sm: "min-h-[var(--web-control-sm)] px-3",
        md: "min-h-[var(--web-control-md)]",
        lg: "min-h-[var(--web-control-lg)]",
        xl: "min-h-[var(--web-control-xl)] px-5 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
