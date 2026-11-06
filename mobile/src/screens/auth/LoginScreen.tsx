import { View } from "react-native";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import { useLoginForm } from "../../auth/use-login-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { ForgotPasswordSheet } from "./ForgotPasswordSheet.tsx";
import { LoginContent } from "./LoginContent.tsx";
import { createAuthStyles } from "./auth-styles.ts";

export function LoginScreen({ snapshot }: { readonly snapshot: AuthSnapshot }) {
  const t = useT();
  const styles = useStyles(createAuthStyles);
  const form = useLoginForm();
  return (
    <View style={styles.root}>
      <LoginContent snapshot={snapshot} form={form} />
      <View style={styles.footer}>
        <Button
          label={t(
            form.isCleanupRetry
              ? "common.actions.retry"
              : snapshot.isOnline
                ? "mobile.login.enter"
                : "mobile.login.waitingSignal",
          )}
          disabled={
            form.isBusy ||
            (!form.isCleanupRetry &&
              (!snapshot.isOnline || !form.username.trim() || !form.password))
          }
          onPress={form.isCleanupRetry ? form.retryCleanup : form.submit}
        />
      </View>
      <ForgotPasswordSheet isOpen={form.isForgotOpen} close={form.closeForgot} />
    </View>
  );
}
