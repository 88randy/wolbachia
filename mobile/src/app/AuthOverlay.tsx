import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Theme } from "@wolbachia/tokens";

import type { AuthSnapshot } from "../auth/auth-controller.ts";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { LoginScreen } from "../screens/auth/LoginScreen.tsx";
import { UnlockScreen } from "../screens/auth/UnlockScreen.tsx";
import { Notice } from "../ui/Notice.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.color.background,
    },
  });

export function AuthOverlay({ snapshot }: { readonly snapshot: AuthSnapshot }) {
  const styles = useStyles(createStyles);
  const { scheme } = useTheme();
  const t = useT();
  return (
    <SafeAreaView style={styles.overlay} accessibilityViewIsModal>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {snapshot.hasClockSkew && snapshot.phase !== "login" ? (
        <Notice tone="warning" icon="alert" message={t("mobile.login.clockSkew")} />
      ) : null}
      {snapshot.phase === "login" ? (
        <LoginScreen snapshot={snapshot} />
      ) : (
        <UnlockScreen key={snapshot.phase} snapshot={snapshot} />
      )}
    </SafeAreaView>
  );
}
