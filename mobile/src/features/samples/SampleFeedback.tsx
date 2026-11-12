import { RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { cameraFixAction } from "../../system-settings/camera-fix.ts";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SampleFeedback({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  // With nothing to pick from, refreshing the downloaded data must stay reachable without an error.
  const hasNoSources = !model.hasDraft && model.sources.length === 0;
  if (!model.errorKey && !hasNoSources) return null;
  return (
    <>
      {model.errorKey ? (
        <InfoNotice
          tone="danger"
          message={t(model.errorKey)}
          action={cameraFixAction(model.errorKey, t)}
        />
      ) : null}
      <SecondaryButton
        icon={RotateCw}
        disabled={model.isBusy}
        label={t(model.errorKey ? "common.actions.retry" : "mobile.sample.refresh")}
        onPress={model.retry}
      />
    </>
  );
}
