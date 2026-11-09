import { mobileTypeScale } from "@wolbachia/tokens";

/**
 * Inter, bundled with the app (`@expo-google-fonts/inter`). The names are the ones the package
 * registers; one family per weight because React Native picks the file by family name.
 */
export const FONT_FAMILY = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

export const MONO_FONT_FAMILY = {
  regular: "JetBrainsMono_400Regular",
  semibold: "JetBrainsMono_600SemiBold",
} as const;

export type TextVariant =
  | "h1"
  | "h2"
  | "body"
  | "bodyStrong"
  | "button"
  | "label"
  | "caption"
  | "captionStrong"
  | "overline"
  | "code"
  | "status"
  | "number";

export interface TextStyleSpec {
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontFamily: string;
  readonly letterSpacing?: number;
  readonly textTransform?: "uppercase";
}

interface VariantSpec {
  readonly size: keyof typeof mobileTypeScale;
  readonly weight: keyof typeof FONT_FAMILY;
  /** Line height as a multiple of the size (`codequim.css`). */
  readonly lineHeight: number;
  readonly uppercase?: boolean;
  readonly mono?: keyof typeof MONO_FONT_FAMILY;
}

const OVERLINE_TRACKING_EM = 0.04;

const VARIANTS: Readonly<Record<TextVariant, VariantSpec>> = {
  h1: { size: "h1", weight: "bold", lineHeight: 1.3 },
  h2: { size: "h2", weight: "bold", lineHeight: 1.35 },
  body: { size: "body", weight: "regular", lineHeight: 1.5 },
  bodyStrong: { size: "body", weight: "semibold", lineHeight: 1.5 },
  button: { size: "button", weight: "bold", lineHeight: 1.3 },
  label: { size: "label", weight: "regular", lineHeight: 1.43 },
  caption: { size: "caption", weight: "regular", lineHeight: 1.4 },
  captionStrong: { size: "caption", weight: "bold", lineHeight: 1.4 },
  overline: {
    size: "caption",
    weight: "semibold",
    mono: "semibold",
    lineHeight: 1.4,
    uppercase: true,
  },
  code: { size: "body", weight: "regular", mono: "regular", lineHeight: 1.5 },
  status: {
    size: "caption",
    weight: "semibold",
    mono: "semibold",
    lineHeight: 1.4,
    uppercase: true,
  },
  number: { size: "number", weight: "bold", mono: "semibold", lineHeight: 1.3 },
};

/**
 * Size, line height and font of a text variant, from the Codequim type scale. Sizes are scaled by
 * the phone's text-size setting (React Native does it), which is how 130 % text works: the design's
 * "130 %" board is the scale of a phone set to a larger text size.
 */
export function textStyleFor(variant: TextVariant, isMonospace = false): TextStyleSpec {
  const spec = VARIANTS[variant];
  const fontSize = mobileTypeScale[spec.size];
  return {
    fontSize,
    lineHeight: Math.round(fontSize * spec.lineHeight),
    fontFamily:
      spec.mono === undefined && !isMonospace
        ? FONT_FAMILY[spec.weight]
        : MONO_FONT_FAMILY[spec.mono ?? "regular"],
    ...(spec.uppercase === true
      ? { letterSpacing: fontSize * OVERLINE_TRACKING_EM, textTransform: "uppercase" as const }
      : {}),
  };
}
