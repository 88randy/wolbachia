import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { Button } from "../../ui/Button.tsx";
import type { M12Model } from "./use-m-12.ts";

export function IncidentRefresh({ model }: { readonly model: M12Model }) {
  const t = useT();
  return (
    <View>
      {model.readError ? (
        <Notice tone="warning" icon="noSignal" message={t("mobile.incidents.readFailed")} />
      ) : null}
      {model.isRefreshing ? (
        <AppText accessibilityLiveRegion="polite">{t("mobile.incidents.refreshing")}</AppText>
      ) : null}
      <Button
        variant="outline"
        label={t(model.readError ? "common.actions.retry" : "mobile.incidents.refresh")}
        disabled={model.isRefreshing}
        onPress={() => {
          void model.refreshRemote();
        }}
      />
    </View>
  );
}
