import { StyleSheet, View } from "react-native";
import type { ReactNode } from "react";

import { useAuthLifecycle } from "../auth/use-auth-lifecycle.ts";
import { useT } from "../i18n/I18nProvider.tsx";
import { Notice } from "../ui/Notice.tsx";
import { IdleWarning } from "./IdleWarning.tsx";
import { AuthOverlay } from "./AuthOverlay.tsx";

const styles = StyleSheet.create({ root: { flex: 1 }, shell: { flex: 1 } });

/** The shell stays mounted under an opaque gate, including when the remote session has ended. */
export function AuthGate({ children }: { readonly children: ReactNode }) {
  const { snapshot, isWarning, touch } = useAuthLifecycle();
  const t = useT();
  const isLocked = snapshot.phase !== "unlocked";
  return (
    <View style={styles.root} onTouchStart={touch}>
      <View
        style={styles.shell}
        pointerEvents={isLocked ? "none" : "auto"}
        accessibilityElementsHidden={isLocked}
        importantForAccessibility={isLocked ? "no-hide-descendants" : "auto"}
      >
        {children}
      </View>
      {!isLocked && snapshot.hasClockSkew ? (
        <Notice tone="warning" icon="alert" message={t("mobile.login.clockSkew")} />
      ) : null}
      {!isLocked && isWarning ? <IdleWarning keepWorking={touch} /> : null}
      {isLocked ? (
        <AuthOverlay snapshot={snapshot} isWarning={isWarning} keepWorking={touch} />
      ) : null}
    </View>
  );
}
