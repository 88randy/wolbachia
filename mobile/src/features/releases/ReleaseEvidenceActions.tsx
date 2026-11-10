import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import type { ReleaseViewModel } from "./view-model.ts";

interface Props {
  readonly model: ReleaseViewModel;
  readonly disabled: boolean;
}
export function ReleaseEvidenceActions({ model, disabled }: Props) {
  const t = useT();
  return (
    <>
      <Button
        variant="outline"
        label={t("mobile.release.capturePhoto")}
        disabled={disabled}
        onPress={model.capturePhoto}
      />
      {model.evidenceCount > 0 ? (
        <Button
          variant="text"
          label={t("mobile.release.undoPhoto")}
          disabled={disabled}
          onPress={model.undoPhoto}
        />
      ) : null}
    </>
  );
}
