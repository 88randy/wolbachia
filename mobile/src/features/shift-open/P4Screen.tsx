import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import { ShiftField } from "./ShiftField.tsx";
import type { M04Model } from "./use-m-04.ts";
export function P4Screen({ model }: { readonly model: M04Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  return (
    <>
      <AppText variant="button">{t("mobile.shiftOpen.motorcycleTitle")}</AppText>
      <Notice tone="info" icon="alert" message={t("mobile.shiftOpen.motorcycleHint")} />
      <ShiftField
        label={t("mobile.shiftOpen.motorcycleCode")}
        value={draft.motorcycle_code}
        onChange={(motorcycle_code) => {
          model.edit({ motorcycle_code });
        }}
      />
      <ShiftAction
        label={t("mobile.shiftOpen.continue")}
        disabled={model.isBusy || !draft.motorcycle_code.trim()}
        onPress={() => {
          void model.run(() => model.service.update({ step: "checklist" }));
        }}
      />
    </>
  );
}
