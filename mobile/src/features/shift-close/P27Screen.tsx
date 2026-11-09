import { ClosedSummary } from "./ClosedSummary.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { CloseDeliveryEvents } from "./CloseDeliveryEvents.tsx";
import { CloseReviewHistory } from "./CloseReviewHistory.tsx";
import { closeDeliveryKey } from "./domain.ts";
import type { CloseSnapshot } from "./service.ts";
export function P27Screen({ state }: { readonly state: CloseSnapshot }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <>
      <Notice tone="info" icon="check" message={t("mobile.shiftClose.phoneClosed")} />
      <Notice tone="info" icon="cloudUp" message={t(closeDeliveryKey(state.events))} />
      <AppText>{t("mobile.shiftClose.retryHint")}</AppText>
      {state.draft ? <ClosedSummary draft={state.draft} /> : null}
      <CloseDeliveryEvents events={state.events} />
      <CloseReviewHistory history={state.history} />
      <Button
        label={t("mobile.shiftOpen.inbox")}
        onPress={() => {
          push({ name: "inbox" });
        }}
      />
    </>
  );
}
