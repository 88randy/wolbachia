import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { CatalogActions } from "./CatalogActions.tsx";
import { ChecklistFields } from "./ChecklistFields.tsx";
import { GateNotice } from "./GateNotice.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import type { M04Model } from "./use-m-04.ts";
export function P5Screen({ model }: { readonly model: M04Model }) {
  const t = useT();
  const gate = model.state?.gate ?? null;
  const isIncomplete = ["unconfigured", "checklist", "note", "catalogChanged"].includes(gate ?? "");
  return (
    <>
      <AppText variant="button">{t("mobile.shiftOpen.checklistTitle")}</AppText>
      <CatalogActions model={model} />
      <ChecklistFields model={model} />
      <GateNotice gate={isIncomplete ? gate : null} />
      <ShiftAction
        label={t("mobile.shiftOpen.continue")}
        disabled={model.isBusy || isIncomplete}
        onPress={() => {
          void model.run(() => model.service.update({ step: "odometer" }));
        }}
      />
    </>
  );
}
