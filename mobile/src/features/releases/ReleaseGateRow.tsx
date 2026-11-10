import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { createReleaseStyles } from "./styles.ts";
import type { ReleaseGateView } from "./view-model.ts";

const STATUS = {
  pass: { tone: "success", icon: "check", key: "mobile.release.pass" },
  fail: { tone: "critical", icon: "ban", key: "mobile.release.fail" },
  unavailable: { tone: "warning", icon: "alert", key: "mobile.release.unavailable" },
} as const;

export function ReleaseGateRow({ gate }: { readonly gate: ReleaseGateView }) {
  const t = useT();
  const styles = useStyles(createReleaseStyles);
  const status = STATUS[gate.state];
  return (
    <View style={styles.group}>
      <AppText variant="button">{t(`mobile.release.gate.${gate.name}`)}</AppText>
      <Badge tone={status.tone} icon={status.icon} label={t(status.key)} />
      {gate.detailKey ? <AppText>{t(gate.detailKey)}</AppText> : null}
      {gate.state === "pass" ? null : (
        <AppText variant="caption">{t(`mobile.release.contact.${gate.contact}`)}</AppText>
      )}
    </View>
  );
}
