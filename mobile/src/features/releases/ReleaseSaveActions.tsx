import { Check } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ReleaseReportActions } from "./ReleaseReportActions.tsx";
import { hasBlockedReleaseGate } from "./view-model.ts";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseSaveActions({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  if (hasBlockedReleaseGate(model.gates)) return <ReleaseReportActions model={model} />;
  const hintKey = model.hasPendingEdits ? "mobile.release.draftPending" : "mobile.release.saveHint";
  return (
    <>
      <AppText variant="caption" tone="secondary">
        {t(hintKey)}
      </AppText>
      <PrimaryButton
        icon={Check}
        label={t("courier.flow.release.done")}
        isLoading={model.isBusy}
        disabled={!model.canSave}
        onPress={model.save}
      />
    </>
  );
}
