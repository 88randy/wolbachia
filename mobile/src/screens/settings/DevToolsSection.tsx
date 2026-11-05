import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useServices } from "../../app/services-context.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { buildTestEvent } from "./test-event.ts";
import { TestTokenField } from "./TestTokenField.tsx";

const styles = StyleSheet.create({ section: { gap: spacing[1] } });

/**
 * Tools to try the sync against a local backend before login exists (#7): this phone's id (the
 * server binds a session to it), a place to paste an access token, and a button that saves a test
 * record. Shown only when the build sets `EXPO_PUBLIC_DEV_TOOLS=1`.
 */
export function DevToolsSection() {
  const t = useT();
  const { deviceId, engine } = useServices();
  return (
    <View style={styles.section}>
      <AppText variant="h2">{t("mobile.dev.title")}</AppText>
      <AppText variant="caption" tone="secondary">
        {t("mobile.dev.deviceId")}
      </AppText>
      <AppText selectable>{deviceId}</AppText>
      <TestTokenField />
      <Button
        variant="outline"
        label={t("mobile.dev.addEvent")}
        onPress={() => {
          void engine.enqueue(buildTestEvent(new Date()));
        }}
      />
    </View>
  );
}
