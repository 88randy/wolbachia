import { ClosedSummary } from "./ClosedSummary.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { closeDeliveryKey } from "./domain.ts";
import type { CloseSnapshot } from "./service.ts";
export function P27Screen({ state }: { readonly state: CloseSnapshot }) {
  const t = useT(); const { push } = useNavigation();
  return <>
    <Notice tone="info" icon="check" message={t("mobile.shiftClose.phoneClosed")} />
    <Notice tone="info" icon="cloudUp" message={t(closeDeliveryKey(state.events))} />
    <AppText>{t("mobile.shiftClose.retryHint")}</AppText>
    {state.draft ? <ClosedSummary draft={state.draft} /> : null}
    {state.events.map((event) => <Card key={event.envelope.id}>
      <AppText variant="mono">{event.envelope.id}</AppText>
      <AppText>{t(closeDeliveryKey([event]))}</AppText>
    </Card>)}
    <AppText variant="button">{t("mobile.shiftClose.reviewHistory")}</AppText>
    {!state.history.length ? <AppText>{t("mobile.shiftClose.notReviewed")}</AppText> : null}
    {state.history.map((entry) => <Card key={entry.id}>
      <AppText>{t(entry.decision_kind === "observe" ? "mobile.shiftClose.observed" : entry.approval_current ? "mobile.shiftClose.approved" : "mobile.shiftClose.staleApproval")}</AppText>
      <AppText>{entry.reason}</AppText><AppText variant="mono">{entry.decided_at}</AppText>
    </Card>)}
    <Button label={t("mobile.shiftOpen.inbox")} onPress={() => { push({ name: "inbox" }); }} />
  </>;
}
