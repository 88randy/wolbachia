import { Bike } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";

export function FuelMotorcycle({ code }: { readonly code: string }) {
  const t = useT();
  const { theme } = useTheme();
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-tint p-4">
      <Bike color={theme.color.action} size={28} strokeWidth={KIT_ICON_STROKE} />
      <View className="flex-1">
        <AppText variant="caption" tone="secondary">
          {t("mobile.fuel.motorcycle")}
        </AppText>
        <AppText variant="bodyStrong" selectable>
          {code}
        </AppText>
      </View>
    </View>
  );
}
