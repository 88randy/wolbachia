import { Camera, Undo2 } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { SampleViewModel } from "./view-model.ts";

export function SamplePhotoActions({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  const disabled = model.isBusy || !model.canEdit || model.status !== "draft";
  return (
    <>
      <SecondaryButton
        icon={Camera}
        label={t("mobile.sample.takePhoto")}
        disabled={disabled}
        onPress={model.capturePhoto}
      />
      {model.evidenceCount > 0 ? (
        <SecondaryButton
          icon={Undo2}
          label={t("mobile.sample.undoPhoto")}
          disabled={disabled}
          onPress={model.undoPhoto}
        />
      ) : null}
    </>
  );
}
