import { RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { cameraFixAction } from "../../system-settings/camera-fix.ts";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M12Model } from "./use-m-12.ts";

export function IncidentFeedback({ model }: { readonly model: M12Model }) {
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
        label={t("common.actions.retry")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(model.refresh);
        }}
      />
    </>
  );
}
