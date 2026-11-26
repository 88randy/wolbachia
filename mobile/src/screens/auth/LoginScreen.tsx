import { LogIn } from "lucide-react-native";
import { View } from "react-native";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import { useLoginForm } from "../../auth/use-login-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { BottomActions } from "../../ui/BottomActions.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ForgotPasswordSheet } from "./ForgotPasswordSheet.tsx";
import { LoginConnectionPanel } from "./LoginConnectionPanel.tsx";
import { LoginContent } from "./LoginContent.tsx";
import { createAuthStyles } from "./auth-styles.ts";

export function LoginScreen({ snapshot }: { readonly snapshot: AuthSnapshot }) {
  const t = useT();
  const styles = useStyles(createAuthStyles);
  const form = useLoginForm();
  if (form.canConfigureServer && form.isServerOpen)
    return <LoginConnectionPanel close={form.toggleServer} />;
  return (
    <View style={styles.root}>
      <LoginContent snapshot={snapshot} form={form} />
      <BottomActions>
        <PrimaryButton
          icon={LogIn}
          label={t(
            form.isCleanupRetry
              ? "common.actions.retry"
              : snapshot.isOnline
                ? "mobile.login.enter"
                : "mobile.login.waitingSignal",
          )}
          isLoading={form.isBusy}
          disabled={
            !form.isCleanupRetry && (!snapshot.isOnline || !form.username.trim() || !form.password)
          }
          onPress={form.isCleanupRetry ? form.retryCleanup : form.submit}
        />
      </BottomActions>
      <ForgotPasswordSheet isOpen={form.isForgotOpen} close={form.closeForgot} />
    </View>
  );
}
