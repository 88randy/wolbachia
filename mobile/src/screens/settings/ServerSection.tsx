import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { TextField } from "../../ui/TextField.tsx";
import { feedbackKey } from "./server-feedback.ts";
import { useServerForm } from "./use-server-form.ts";

const styles = StyleSheet.create({ section: { gap: spacing[1] } });

/**
 * Initial provisioning only. A bound phone refuses address changes through the domain guard;
 * Settings keeps the localized reason available for someone who needs their supervisor.
 */
export function ServerSection() {
  const t = useT();
  const { text, setText, feedback, save, reset } = useServerForm();
  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong">{t("mobile.settings.server")}</AppText>
      <TextField
        label={t("mobile.settings.server")}
        placeholder={t("mobile.settings.serverHint")}
        value={text}
        onChangeText={setText}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      {feedback === null ? null : <AppText>{t(feedbackKey(feedback))}</AppText>}
      <Button label={t("mobile.settings.serverSave")} onPress={save} />
      <Button variant="text" label={t("mobile.settings.serverReset")} onPress={reset} />
    </View>
  );
}
