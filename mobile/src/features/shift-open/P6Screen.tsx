import { DraftNotes } from "./DraftNotes.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { OdometerPhoto } from "./OdometerPhoto.tsx";
import { OdometerReference } from "./OdometerReference.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import { ShiftField } from "./ShiftField.tsx";
import type { M04Model } from "./use-m-04.ts";
export function P6Screen({ model }: { readonly model: M04Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  return (
    <>
      <AppText variant="button">{t("mobile.shiftOpen.odometerTitle")}</AppText>
      <OdometerPhoto model={model} />
      <ShiftField
        label={t("mobile.shiftOpen.odometerKm")}
        value={draft.odometer_km}
        numeric
        onChange={(odometer_km) => {
          model.edit({ odometer_km });
        }}
      />
      <OdometerReference state={model.state} />
      <DraftNotes model={model} />
      <ShiftAction
        label={t("mobile.shiftOpen.continue")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(() => model.service.update({ step: "maps" }));
        }}
      />
    </>
  );
}
