import { ChevronLeft } from "lucide-react-native";
import { Pressable } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { KIT_ICON_STROKE } from "./kit-styles.ts";

/** 48 dp "Regresar" button of the AppHeader. */
export function BackButton({ onPress }: { readonly onPress: () => void }) {
  const t = useT();
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("courier.header.back")}
      onPress={onPress}
      hitSlop={8}
      className="h-12 w-12 items-center justify-center rounded-xl bg-surface-muted active:opacity-70"
    >
      <ChevronLeft color={theme.color.text.primary} size={26} strokeWidth={KIT_ICON_STROKE} />
    </Pressable>
  );
}
