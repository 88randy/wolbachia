import { RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseFeedback({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  if (!model.errorKey) return null;
  return (
    <>
      <InfoNotice tone="danger" message={t(model.errorKey)} />
      <SecondaryButton
        icon={RotateCw}
        disabled={model.isBusy}
        label={t("common.actions.retry")}
        onPress={model.retry}
      />
    </>
  );
}
