import { ServerOutcome } from "./ServerOutcome.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { STATUS_BADGE_KEY } from "../../sync/inbox-model.ts";
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
      <AppText>{state.draft?.motorcycle_code}</AppText>
      <Notice tone="info" icon="alert" message={t(deliveryKey(opening))} />
      <AppText>{t(STATUS_BADGE_KEY[opening.status])}</AppText>
      <AppText>{t("mobile.shiftOpen.reviewPending")}</AppText>
      <ServerOutcome opening={opening} />
      {state.gate === "severe" ? (
        <Notice tone="critical" icon="alert" message={t("mobile.shiftOpen.severe")} />
      ) : null}
    </>
  );
}
