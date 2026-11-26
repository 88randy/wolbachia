import { Image, View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";

export interface WordmarkProps {
  /**
   * Organization logo from the organization settings, when the app has it. Never a bundled
   * client logo: without it the clean "AedesVision" text wordmark is shown.
   */
  readonly logoUri?: string | null;
  readonly size?: "large" | "small";
}

/** App identity: organization logo when known, otherwise the AedesVision text wordmark. */
export function Wordmark({ logoUri, size = "large" }: WordmarkProps) {
  const t = useT();
  const { theme } = useTheme();
  const name = t("courier.app.name");
  const isLarge = size === "large";
  if (logoUri)
    return (
      <Image
        accessibilityLabel={name}
        source={{ uri: logoUri }}
        resizeMode="contain"
        className={isLarge ? "h-14 w-48" : "h-8 w-28"}
      />
    );
  return (
    <View accessible accessibilityLabel={name} className="flex-row items-center gap-2">
      <View
        className={`items-center justify-center rounded-xl bg-action ${isLarge ? "h-11 w-11" : "h-8 w-8"}`}
      >
        <AppText variant={isLarge ? "h2" : "bodyStrong"} style={{ color: theme.color.onAction }}>
          {name.charAt(0)}
        </AppText>
      </View>
      <AppText variant={isLarge ? "h1" : "bodyStrong"} style={{ color: theme.color.navy }}>
        {name}
      </AppText>
    </View>
  );
}
