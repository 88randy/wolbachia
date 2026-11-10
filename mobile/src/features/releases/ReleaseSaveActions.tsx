import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import { ReleaseReportActions } from "./ReleaseReportActions.tsx";
import { hasBlockedReleaseGate } from "./view-model.ts";
import type { ReleaseViewModel } from "./view-model.ts";

export function ReleaseSaveActions({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  const isBlocked = hasBlockedReleaseGate(model.gates);
  const hintKey = model.hasPendingEdits
    ? "mobile.release.draftPending"
    : isBlocked
      ? "mobile.release.noBypass"
      : "mobile.release.saveHint";
  const save = {
    label: t(model.isBusy ? "mobile.release.working" : "mobile.release.save"),
    disabled: model.isBusy || isBlocked || !model.canSave,
    onPress: model.save,
  };
  return (
    <>
      <AppText variant="caption">{t(hintKey)}</AppText>
      <Button {...save} />
      {isBlocked ? <ReleaseReportActions model={model} /> : null}
    </>
  );
}
