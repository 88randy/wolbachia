import { RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { cameraFixAction } from "../../system-settings/camera-fix.ts";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleFeedback({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (!model.errorKey) return null;
  return (
    <>
      <InfoNotice
        tone="danger"
        message={t(model.errorKey)}
        action={cameraFixAction(model.errorKey, t)}
      />
      <SecondaryButton
        icon={RotateCw}
        disabled={model.isBusy}
        label={t("common.actions.retry")}
        onPress={model.retry}
      />
    </>
  );
}
