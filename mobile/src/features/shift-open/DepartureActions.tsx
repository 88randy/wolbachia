import { useT } from "../../i18n/I18nProvider.tsx";
import { GateNotice } from "./GateNotice.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import type { M04Model } from "./use-m-04.ts";
export function DepartureActions({ model }: { readonly model: M04Model }) {
  const t = useT();
  const gate = model.state?.gate ?? null;
  const isBlocked = gate !== null && gate !== "severe";
  return (
    <>
      <ShiftAction
        label={t("common.actions.retry")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(() => model.service.prepareMap());
        }}
      />
      <GateNotice gate={gate} />
      <ShiftAction
        label={t(gate === "severe" ? "mobile.shiftOpen.recordSevere" : "mobile.shiftOpen.start")}
        disabled={model.isBusy || isBlocked}
        onPress={() => {
          void model.run(() => model.service.open());
        }}
      />
    </>
  );
}
