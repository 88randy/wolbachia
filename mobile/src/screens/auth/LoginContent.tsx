import { ScrollView, View } from "react-native";
import appManifest from "../../../package.json";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import type { useLoginForm } from "../../auth/use-login-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { ServerSection } from "../settings/ServerSection.tsx";
import { loginNotice } from "./auth-notice-presentation.ts";
import { AuthNotice } from "./AuthNotice.tsx";
import { LoginFields } from "./LoginFields.tsx";
import { createAuthStyles } from "./auth-styles.ts";

interface LoginContentProps {
  readonly snapshot: AuthSnapshot;
  readonly form: ReturnType<typeof useLoginForm>;
}
export function LoginContent({ snapshot, form }: LoginContentProps) {
  const t = useT();
  const styles = useStyles(createAuthStyles);
  const notice = loginNotice(snapshot, form.error);
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.logo}>
        <AppText variant="caption">{t("mobile.login.logo")}</AppText>
      </View>
      <AppText variant="h1">{t("mobile.login.title")}</AppText>
      <AuthNotice notice={notice} />
      <LoginFields
        form={form}
        hasError={snapshot.notice?.key === "mobile.login.wrongCredentials"}
      />
      <Button variant="text" label={t("mobile.login.forgotPassword")} onPress={form.openForgot} />
      <Button variant="text" label={t("mobile.login.serverSettings")} onPress={form.toggleServer} />
      {form.isServerOpen ? <ServerSection /> : null}
      <View style={styles.spacer} />
      <AppText variant="caption" style={styles.centered}>
        {t("mobile.login.version", { version: appManifest.version })}
      </AppText>
    </ScrollView>
  );
}
