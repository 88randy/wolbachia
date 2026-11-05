import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import type { M04Model } from "./use-m-04.ts";
export function OdometerPhoto({ model }: { readonly model: M04Model }) {
  const t = useT();
  const capture = () => {
    void model.run(async () => {
      const result = await model.service.capturePhoto();
      if (result === "unavailable") model.setError("mobile.shiftOpen.photoUnavailable");
    });
  };
  return (
    <>
      <AppText>{t("mobile.shiftOpen.photoHint")}</AppText>
      <ShiftAction
        label={t("mobile.shiftOpen.capturePhoto")}
        disabled={model.isBusy}
        onPress={capture}
      />
      <AppText>{t("mobile.shiftOpen.photoCount")}</AppText>
      <AppText>{model.state?.draft?.photoRefs.length ?? 0}</AppText>
    </>
  );
}
