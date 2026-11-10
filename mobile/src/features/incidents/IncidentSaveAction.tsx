import { Send } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import type { M12Model } from "./use-m-12.ts";

export function IncidentSaveAction({ model }: { readonly model: M12Model }) {
  const t = useT();
  return (
    <>
      <AppText variant="caption" tone="secondary">
        {t("mobile.incidents.saveHint")}
      </AppText>
      <PrimaryButton
        icon={Send}
        label={t("courier.flow.incident.send")}
        isLoading={model.isBusy}
        disabled={!model.state?.ready}
        onPress={model.save}
      />
    </>
  );
}
