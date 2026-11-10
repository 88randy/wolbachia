import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { LockedEmergencyCall } from "../incidents/LockedEmergencyCall.tsx";
import type { SafetyRules, SafetyState } from "./domain.ts";
import { SpeedPanel } from "./SpeedPanel.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.color.chrome,
    },
    content: { flexGrow: 1, justifyContent: "center", gap: spacing[2], padding: spacing[3] },
    actions: { padding: spacing[3], gap: spacing[2] },
    center: { textAlign: "center" },
  });

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
  const styles = useStyles(createStyles);
  const t = useT();
  return (
    <SafeAreaView style={styles.overlay} accessibilityViewIsModal>
      <AppScrollView contentContainerStyle={styles.content}>
        <AppText variant="h1" tone="onChrome" style={styles.center} accessibilityRole="header">
          {t("mobile.speedLock.title")}
        </AppText>
        <AppText tone="onChrome" style={styles.center}>
          {t("mobile.speedLock.body")}
        </AppText>
        <SpeedPanel safety={safety} rules={rules} />
      </AppScrollView>
      <View style={styles.actions}>
        <AppText variant="caption" tone="onChrome" style={styles.center}>
          {t("mobile.speedLock.emergencyOnly")}
        </AppText>
        <LockedEmergencyCall />
      </View>
    </SafeAreaView>
  );
}
