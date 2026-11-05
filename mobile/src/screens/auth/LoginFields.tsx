import { View } from "react-native";

import type { useLoginForm } from "../../auth/use-login-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { PasswordField } from "./PasswordField.tsx";
import { createAuthStyles } from "./auth-styles.ts";

interface LoginFieldsProps {
  readonly form: ReturnType<typeof useLoginForm>;
  readonly hasError: boolean;
}
export function LoginFields({ form, hasError }: LoginFieldsProps) {
  const t = useT();
  const styles = useStyles(createAuthStyles);
  return (
    <View style={styles.field}>
      <AppText variant="label">{t("mobile.login.username")}</AppText>
      <TextField
        label={t("mobile.login.username")}
        value={form.username}
        onChangeText={form.setUsername}
        style={hasError && styles.invalidField}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!form.isBusy}
        autoComplete="username"
      />
      <PasswordField {...form} hasError={hasError} />
    </View>
  );
}
