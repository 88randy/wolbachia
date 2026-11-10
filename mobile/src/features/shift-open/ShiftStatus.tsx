import { ServerOutcome } from "./ServerOutcome.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { GateNotice } from "./GateNotice.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { deliveryKey } from "./domain.ts";
import type { ShiftSnapshot } from "./service.ts";
/** Phone storage, receipt and review never share a success label. */
export function ShiftStatus({ state }: { readonly state: ShiftSnapshot }) {
  const t = useT();
  const opening = state.opening;
  if (opening === null) return null;
  return (
    <>
      <AppText variant="bodyStrong">{state.draft?.motorcycle_code}</AppText>
      <Notice tone="info" icon="check" message={t(deliveryKey(opening))} />
      {state.gate === "severe" ? (
        <Notice tone="critical" icon="alert" message={t("mobile.shiftOpen.severeSaved")} />
      ) : state.gate ? (
        <GateNotice gate={state.gate} />
      ) : (
        <ServerOutcome opening={opening} />
      )}
    </>
  );
}
