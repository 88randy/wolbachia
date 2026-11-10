import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { BottomActions } from "../../ui/BottomActions.tsx";
import { Button } from "../../ui/Button.tsx";
import type { SampleViewModel } from "./view-model.ts";

function SavedFooter({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  return (
    <BottomActions>
      <Button label={t("mobile.sample.backToDay")} onPress={model.backToDay} />
    </BottomActions>
  );
}
function isDisabled(model: SampleViewModel): boolean {
  return (
    model.isBusy ||
    (model.hasDraft
      ? !model.canSave || model.blockers.length > 0 || model.hasPendingEdits
      : !model.canBegin)
  );
}
export function SampleFooter({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  if (model.isLoading) return null;
  if (model.status !== "draft") return <SavedFooter model={model} />;
  return (
    <BottomActions>
      <AppText variant="caption">
        {t(model.hasPendingEdits ? "mobile.sample.pendingEdits" : "mobile.sample.saveHint")}
      </AppText>
      <Button
        label={t(
          model.isBusy
            ? "mobile.sample.working"
            : model.hasDraft
              ? "mobile.sample.save"
              : "mobile.sample.begin",
        )}
        disabled={isDisabled(model)}
        onPress={model.hasDraft ? model.save : model.begin}
      />
    </BottomActions>
  );
}
