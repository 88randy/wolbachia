import { ArrowLeft, Check, Play } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import type { SampleViewModel } from "./view-model.ts";

function isDisabled(model: SampleViewModel): boolean {
  return model.hasDraft
    ? !model.canSave || model.blockers.length > 0 || model.hasPendingEdits
    : !model.canBegin;
}
export function SampleFooter({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.isLoading) return null;
  if (model.status !== "draft") {
    return (
      <PrimaryButton
        icon={ArrowLeft}
        label={t("mobile.sample.backToDay")}
        onPress={model.backToDay}
      />
    );
  }
  return (
    <>
      <AppText variant="caption" tone="secondary">
        {t(model.hasPendingEdits ? "mobile.sample.pendingEdits" : "mobile.sample.saveHint")}
      </AppText>
      <PrimaryButton
        icon={model.hasDraft ? Check : Play}
        label={t(model.hasDraft ? "courier.flow.sample.done" : "mobile.sample.begin")}
        isLoading={model.isBusy}
        disabled={isDisabled(model)}
        onPress={model.hasDraft ? model.save : model.begin}
      />
    </>
  );
}
