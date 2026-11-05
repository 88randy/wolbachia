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
 * The API address. A person can point the phone at another server (for example a developer's PC on
 * the same Wi-Fi) without a new build. Only a valid address is saved.
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
