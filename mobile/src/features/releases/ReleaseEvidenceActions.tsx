import { Camera, Undo2 } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

interface Props {
  readonly model: ReleaseViewModel;
  readonly disabled: boolean;
}
export function ReleaseEvidenceActions({ model, disabled }: Props) {
  const t = useT();
  return (
    <>
      <SecondaryButton
        icon={Camera}
        label={t("mobile.release.capturePhoto")}
        disabled={disabled}
        onPress={model.capturePhoto}
      />
      {model.evidenceCount > 0 ? (
        <SecondaryButton
          icon={Undo2}
          label={t("mobile.release.undoPhoto")}
          disabled={disabled}
          onPress={model.undoPhoto}
        />
      ) : null}
    </>
  );
}
