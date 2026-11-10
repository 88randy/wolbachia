import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SamplePhotoActions({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  const disabled = model.isBusy || !model.canEdit || model.status !== "draft";
  return (
    <>
      <Button
        variant="outline"
        label={t("mobile.sample.takePhoto")}
        disabled={disabled}
        onPress={model.capturePhoto}
      />
      {model.evidenceCount > 0 ? (
        <Button
          variant="outline"
          label={t("mobile.sample.undoPhoto")}
          disabled={disabled}
          onPress={model.undoPhoto}
        />
      ) : null}
    </>
  );
}
