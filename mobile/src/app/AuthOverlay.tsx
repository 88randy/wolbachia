import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Theme } from "@wolbachia/tokens";

import type { AuthSnapshot } from "../auth/auth-controller.ts";
import { shouldRunIdleTimer } from "../auth/idle-policy.ts";
import { IdleWarning } from "./IdleWarning.tsx";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { LoginScreen } from "../screens/auth/LoginScreen.tsx";
import { UnlockScreen } from "../screens/auth/UnlockScreen.tsx";
import { Notice } from "../ui/Notice.tsx";
import { LockedEmergencyCall } from "../features/incidents/LockedEmergencyCall.tsx";

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

interface AuthOverlayProps {
  readonly snapshot: AuthSnapshot;
  readonly isWarning: boolean;
  readonly keepWorking: () => void;
}
export function AuthOverlay({ snapshot, isWarning, keepWorking }: AuthOverlayProps) {
  const styles = useStyles(createStyles);
  const t = useT();
  return (
    <SafeAreaView style={styles.overlay} accessibilityViewIsModal>
      {snapshot.hasClockSkew && snapshot.phase !== "login" ? (
        <Notice tone="warning" icon="alert" message={t("mobile.login.clockSkew")} />
      ) : null}
      {shouldRunIdleTimer(snapshot.phase) && isWarning ? (
        <IdleWarning keepWorking={keepWorking} />
      ) : null}
      {snapshot.phase === "login" ? (
        <LoginScreen snapshot={snapshot} />
      ) : (
        <UnlockScreen key={snapshot.phase} snapshot={snapshot} />
      )}
      <LockedEmergencyCall />
    </SafeAreaView>
  );
}
