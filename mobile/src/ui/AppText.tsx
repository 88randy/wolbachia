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
  /** Codes, dates, times and quantities keep their size but use the bundled mono family. */
  readonly isMonospace?: boolean;
}

// Tabular figures only where numbers must line up: Inter's `tnum` also widens hyphens, which made
// codes like M-DEMO-01 look letter-spaced.
const styles = StyleSheet.create({ tabular: { fontVariant: ["tabular-nums"] } });

/**
 * Shared text: Inter for prose, JetBrains Mono for data, shared sizes and theme colors.
 * It never sets `numberOfLines`: at 130 % text nothing may be cut off.
 */
export function AppText({
  variant = "body",
  tone = "primary",
  isMonospace = false,
  style,
  ...rest
}: AppTextProps) {
  const { theme, textScale } = useTheme();
  const color = tone === "onChrome" ? ON_CHROME_COLOR : theme.color.text[tone];
  return (
    <Text
      {...rest}
      style={[
        isMonospace && styles.tabular,
        textStyleFor(variant, isMonospace, textScale),
        { color },
        style,
      ]}
    />
  );
}
