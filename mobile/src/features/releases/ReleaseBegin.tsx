import { Play } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseBegin({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  return (
    <>
      <AppText variant="body" tone="secondary">
        {t("mobile.release.beginHint")}
      </AppText>
      <PrimaryButton
        icon={Play}
        label={t("mobile.release.begin")}
        disabled={!model.canBegin}
        isLoading={model.isBusy}
        onPress={model.begin}
      />
    </>
  );
}
