import { OctagonAlert } from "lucide-react-native";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { LockedEmergencyCall } from "../incidents/LockedEmergencyCall.tsx";
import type { SafetyRules, SafetyState } from "./domain.ts";
import { SpeedPanel } from "./SpeedPanel.tsx";

interface P32Props {
  readonly safety: SafetyState;
  readonly rules: SafetyRules;
}

/**
 * P32 speed lock. It covers the app without unmounting it, so the open form and its draft stay in
 * place. Only the emergency call is offered: it opens the dialer and never unlocks data entry.
 * The content scrolls so 130 % text never pushes the emergency action off screen.
 */
export function P32Screen({ safety, rules }: P32Props) {
  const t = useT();
  const { theme } = useTheme();
  return (
    <SafeAreaView className="absolute inset-0 bg-navy" accessibilityViewIsModal>
      <AppScrollView contentContainerClassName="grow justify-center gap-5 p-6">
        <View className="items-center">
          <View className="h-28 w-28 items-center justify-center rounded-full bg-danger">
            <OctagonAlert color={theme.color.onAction} size={64} strokeWidth={2.25} />
          </View>
        </View>
        <AppText variant="h1" tone="onChrome" className="text-center" accessibilityRole="header">
          {t("mobile.speedLock.title")}
        </AppText>
        <AppText tone="onChrome" className="text-center">
          {t("mobile.speedLock.body")}
        </AppText>
        <SpeedPanel safety={safety} rules={rules} />
      </AppScrollView>
      <View className="gap-3 p-6">
        <AppText variant="caption" tone="onChrome" className="text-center">
          {t("mobile.speedLock.emergencyOnly")}
        </AppText>
        <LockedEmergencyCall />
      </View>
    </SafeAreaView>
  );
}
