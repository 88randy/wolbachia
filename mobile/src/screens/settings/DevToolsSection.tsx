import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useServices } from "../../app/services-context.ts";
import { useOutboxAction } from "../../outbox/use-outbox-action.ts";
import { Notice } from "../../ui/Notice.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { buildTestEvent } from "./test-event.ts";

const styles = StyleSheet.create({ section: { gap: spacing[1] } });

/**
 * Tools to inspect this phone's id and save a test record using the authenticated session. Shown only when the build sets `EXPO_PUBLIC_DEV_TOOLS=1`.
 */
export function DevToolsSection() {
  const t = useT();
  const { deviceId, engine } = useServices();
  const { run, errorKey } = useOutboxAction(() => engine.enqueue(buildTestEvent(new Date())));
  return (
    <View style={styles.section}>
      <AppText variant="h2">{t("mobile.dev.title")}</AppText>
      <AppText variant="caption" tone="secondary">
        {t("mobile.dev.deviceId")}
      </AppText>
      <AppText selectable>{deviceId}</AppText>
      {errorKey !== null && <Notice tone="critical" icon="alert" message={t(errorKey)} />}
      <Button variant="outline" label={t("mobile.dev.addEvent")} onPress={run} />
    </View>
  );
}
