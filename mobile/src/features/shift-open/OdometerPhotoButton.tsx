import { Camera } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { M04Model } from "./use-m-04.ts";

/** "Tomar foto": opens the camera, then confirms the photo is kept on the phone. */
export function OdometerPhotoButton({ model }: { readonly model: M04Model }) {
  const t = useT();
  const count = model.state?.draft?.photoRefs.length ?? 0;
  const capture = () => {
    void model.run(async () => {
      const result = await model.service.capturePhoto();
      if (result === "unavailable") model.setError("mobile.shiftOpen.photoUnavailable");
    });
  };
  return (
    <>
      <SecondaryButton
        icon={Camera}
        label={t(count > 0 ? "field.open.photoAgain" : "field.open.photoTake")}
        disabled={model.isBusy}
        onPress={capture}
      />
      {count > 0 ? <InfoNotice tone="success" message={t("field.open.photoSaved")} /> : null}
    </>
  );
}
