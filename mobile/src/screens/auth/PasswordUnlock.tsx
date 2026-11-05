import { View } from "react-native";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import type { useUnlockForm } from "../../auth/use-unlock-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles, useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Icon } from "../../ui/Icon.tsx";
import { Button } from "../../ui/Button.tsx";
import { PasswordField } from "./PasswordField.tsx";
import { AuthNotice } from "./AuthNotice.tsx";
import { createAuthStyles } from "./auth-styles.ts";

interface PasswordUnlockProps {
  readonly snapshot: AuthSnapshot;
  readonly form: ReturnType<typeof useUnlockForm>;
}
export function PasswordUnlock({ snapshot, form }: PasswordUnlockProps) {
  const t = useT();
  const { theme } = useTheme();
  const styles = useStyles(createAuthStyles);
  return (
    <View style={styles.password}>
      <Icon name="lock" color={theme.color.status.warning.fg} />
      <AppText>
        {t(
          snapshot.isPinSetupRequired
            ? "mobile.unlock.resumeSetup"
            : "mobile.unlock.passwordRequired",
          { count: snapshot.rules.pinMaxAttempts },
        )}
      </AppText>
      <PasswordField {...form} />
      <AuthNotice notice={snapshot.notice} />
      <AppText variant="caption">{t("mobile.unlock.savedWork")}</AppText>
      <Button
        label={t("mobile.login.enter")}
        disabled={form.isBusy || !form.password}
        onPress={form.submitPassword}
      />
    </View>
  );
}
