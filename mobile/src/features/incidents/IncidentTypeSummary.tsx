import { View } from "react-native";
import type { Schemas } from "@wolbachia/api-client";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
export function IncidentTypeSummary({ type }: { readonly type: Schemas["IncidentType"] | null }) {
  const t = useT();
  return (
    <View>
      <AppText>{t("mobile.incidents.type")}</AppText>
      <AppText>{type?.label ?? t("mobile.incidents.typeRequired")}</AppText>
      {type?.is_other ? <AppText>{t("mobile.incidents.otherHint")}</AppText> : null}
    </View>
  );
}
