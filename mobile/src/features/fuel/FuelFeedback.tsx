import { RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { CameraPermissionFix } from "../../system-settings/CameraPermissionFix.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M11Model } from "./use-m-11.ts";

export function FuelFeedback({ model }: { readonly model: M11Model }) {
  const t = useT();
  if (!model.errorKey) return null;
  return (
    <>
      <InfoNotice tone="danger" message={t(model.errorKey)} />
      <CameraPermissionFix errorKey={model.errorKey} />
      <SecondaryButton
        icon={RotateCw}
        label={t("common.actions.retry")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(model.refresh);
        }}
      />
    </>
  );
}
