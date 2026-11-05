import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { ShiftSnapshot } from "./service.ts";
export function OdometerReference({ state }: { readonly state: ShiftSnapshot | null }) {
  const t = useT();
  return (
    <>
      <AppText>{t("mobile.shiftOpen.lastOdometer")}</AppText>
      <AppText>{state?.lastOdometer ?? t("mobile.shiftOpen.unknownOdometer")}</AppText>
      {state?.hasOdometerWarning ? (
        <Notice tone="warning" icon="alert" message={t("mobile.shiftOpen.odometerWarning")} />
      ) : null}
    </>
  );
}
