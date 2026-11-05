import { StyleSheet, Text } from "react-native";
import type { TextProps } from "react-native";

import { ON_CHROME_COLOR } from "../theme/on-chrome.ts";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { textStyleFor } from "../theme/typography.ts";
import type { TextVariant } from "../theme/typography.ts";

type TextTone = "primary" | "secondary" | "tertiary" | "onChrome";

interface AppTextProps extends TextProps {
  readonly variant?: TextVariant;
  readonly tone?: TextTone;
}

// Digits keep a fixed width (Inter's `tnum`) so counts and times line up.
const styles = StyleSheet.create({ tabular: { fontVariant: ["tabular-nums"] } });

/**
 * The only text component of the app: Inter, Codequim sizes, tabular figures, theme colors.
 * It never sets `numberOfLines`: at 130 % text nothing may be cut off.
 */
export function AppText({ variant = "body", tone = "primary", style, ...rest }: AppTextProps) {
  const { theme } = useTheme();
  const color = tone === "onChrome" ? ON_CHROME_COLOR : theme.color.text[tone];
  return <Text {...rest} style={[styles.tabular, textStyleFor(variant), { color }, style]} />;
}
