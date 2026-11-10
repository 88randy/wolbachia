import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { createReleaseStyles } from "./styles.ts";
import type { ReleaseViewModel } from "./view-model.ts";

const REFERENCE_FIELDS = ["deviceId", "taskId", "permitId", "lotId"] as const;

export function ReleaseReferences({ refs }: { readonly refs: ReleaseViewModel["refs"] }) {
  const t = useT();
  const styles = useStyles(createReleaseStyles);
  return (
    <Card>
      {REFERENCE_FIELDS.map((field) => (
        <View key={field} style={styles.reference}>
          <AppText variant="caption">{t(`mobile.release.${field}`)}</AppText>
          <AppText isMonospace>{refs[field] ?? t("mobile.release.referenceUnavailable")}</AppText>
        </View>
      ))}
    </Card>
  );
}
