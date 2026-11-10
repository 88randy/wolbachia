import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import type { CloseSnapshot } from "./service.ts";

function decisionKey(entry: CloseSnapshot["history"][number]): MessageKey {
  if (entry.decision_kind === "observe") return "mobile.shiftClose.observed";
  return entry.approval_current ? "mobile.shiftClose.approved" : "mobile.shiftClose.staleApproval";
}
export function CloseReviewHistory({ history }: { readonly history: CloseSnapshot["history"] }) {
  const t = useT();
  return (
    <>
      <AppText variant="button">{t("mobile.shiftClose.reviewHistory")}</AppText>
      {!history.length ? <AppText>{t("mobile.shiftClose.notReviewed")}</AppText> : null}
      {history.map((entry) => (
        <Card key={entry.id}>
          <AppText>{t(decisionKey(entry))}</AppText>
          <AppText>{entry.reason}</AppText>
          <AppText variant="caption">{entry.decided_at}</AppText>
        </Card>
      ))}
    </>
  );
}
