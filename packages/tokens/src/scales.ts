/**
 * Theme-independent scales shared by mobile and web. All lengths are in px
 * (density-independent pixels on React Native).
 */

/** Corner radius scale. `sm`..`xl` come from Codequim; `xs` and `full` are added for the web. */
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  /** Large enough to make any box a pill or a circle. */
  full: 9999,
} as const;

/**
 * Spacing scale. Base unit 8 px; the key is the multiple of the base unit,
 * so `spacing[0.5]` is the 4 px half step.
 */
export const spacing = {
  0.5: 4,
  1: 8,
  1.5: 12,
  2: 16,
  2.5: 20,
  3: 24,
  4: 32,
  5: 40,
  6: 48,
} as const;

/** Names of the mobile type scale steps (`--fs-*` in codequim.css). */
export interface MobileTypeScale {
  /** Large figures (counters). */
  readonly number: number;
  readonly h1: number;
  readonly h2: number;
  readonly body: number;
  readonly button: number;
  readonly label: number;
  readonly caption: number;
}

/** Mobile font sizes at 100 % text size. */
export const mobileTypeScale: MobileTypeScale = {
  number: 40,
  h1: 24,
  h2: 20,
  body: 16,
  button: 17,
  label: 14,
  caption: 13,
};

/** Mobile font sizes when the user enlarges text to 130 % (`.x130` in codequim.css). */
export const mobileTypeScale130: MobileTypeScale = {
  number: 52,
  h1: 31,
  h2: 26,
  body: 21,
  button: 22,
  label: 18,
  caption: 17,
};

/** Font family and numeric style shared by mobile and web. */
export const font = {
  /** Family name to bundle in the mobile app and to load on the web. */
  family: "Inter",
  /** CSS font stack for the web. */
  cssStack: "Inter, Roboto, system-ui, sans-serif",
  /** Digits keep a fixed width so counts and times align. CSS `font-variant-numeric`. */
  tabularFigures: "tabular-nums",
} as const;

/** A single drop shadow in a form both React Native and CSS can use. */
export interface ShadowToken {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly blur: number;
  readonly color: string;
}

/** Elevation levels. */
export const shadow = {
  /** Cards and raised controls (`--sh-1`). */
  level1: { offsetX: 0, offsetY: 1, blur: 2, color: "rgba(10, 26, 63, 0.08)" },
} as const satisfies Record<string, ShadowToken>;

/** Formats a shadow as a CSS `box-shadow` value. */
export function formatShadow(token: ShadowToken): string {
  return `${String(token.offsetX)}px ${String(token.offsetY)}px ${String(token.blur)}px ${token.color}`;
}
