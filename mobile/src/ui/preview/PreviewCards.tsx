import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../AppText.tsx";
import { Badge } from "../Badge.tsx";
import { Card } from "../Card.tsx";

const SAMPLE_CODE = "OV-DEMO-024";
const SAMPLE_TIME = "08:12";
const SAMPLE_PROGRESS = "18 / 40";
const styles = StyleSheet.create({
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing[1] },
});

export function PreviewCards() {
  const t = useT();
  return (
    <Card>
      <AppText variant="overline" tone="secondary">
        {t("mobile.preview.data")}
      </AppText>
      <AppText variant="number">{SAMPLE_PROGRESS}</AppText>
      <AppText>{t("mobile.preview.progress")}</AppText>
      <AppText variant="code">{SAMPLE_CODE}</AppText>
      <AppText variant="code" tone="secondary">
        {SAMPLE_TIME}
      </AppText>
      <View style={styles.pills}>
        <Badge tone="success" icon="cloudOk" label={t("mobile.preview.received")} />
        <Badge tone="warning" icon="phone" label={t("mobile.preview.onPhone")} />
        <Badge tone="critical" icon="alert" label={t("mobile.preview.problem")} />
        <Badge tone="info" icon="clock" label={t("mobile.preview.review")} />
        <Badge tone="neutral" icon="ban" label={t("mobile.preview.inactive")} />
      </View>
    </Card>
  );
}
