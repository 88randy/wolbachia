import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import type { M12Model } from "./use-m-12.ts";
export function IncidentSaveAction({ model }: { readonly model: M12Model }) {
  const t = useT();
  return (
    <View>
      <AppText variant="caption">{t("mobile.incidents.saveHint")}</AppText>
      <Button
        label={t(model.isBusy ? "mobile.incidents.working" : "mobile.incidents.save")}
        disabled={model.isBusy || !model.state?.ready}
        onPress={model.save}
      />
    </View>
  );
}
