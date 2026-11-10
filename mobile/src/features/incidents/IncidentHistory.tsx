import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { IncidentHistoryRow } from "./IncidentHistoryRow.tsx";
import type { M12Model } from "./use-m-12.ts";
/** Only server-readable own cases are shown; a retained page is never a delivery/read receipt. */
export function IncidentHistory({ model }: { readonly model: M12Model }) {
  const t = useT(),
    incidents = model.state?.incidents ?? [];
  const emptyKey = model.state?.canRead
    ? "mobile.incidents.noIncidents"
    : "mobile.incidents.readUnavailable";
  return (
    <View>
      <AppText variant="h2" accessibilityRole="header">
        {t("mobile.incidents.mine")}
      </AppText>
      <AppText variant="caption">{t("mobile.incidents.pageHint")}</AppText>
      <AppText variant="caption">{t("mobile.incidents.repliesUnavailable")}</AppText>
      {incidents.length ? (
        incidents.map((incident) => <IncidentHistoryRow key={incident.id} incident={incident} />)
      ) : (
        <AppText>{t(emptyKey)}</AppText>
      )}
    </View>
  );
}
