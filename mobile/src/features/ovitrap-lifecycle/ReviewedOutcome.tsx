import { View } from "react-native";
import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
const EFFECT: Record<Schemas["ReviewHistoryEntry"]["effect_state"], MessageKey> = {
  applied_review: "mobile.lifecycle.effectApplied",
  adopted_legacy: "mobile.lifecycle.effectAdopted",
  discarded: "mobile.lifecycle.effectDiscarded",
  incident_open: "mobile.lifecycle.effectIncident",
  approved: "mobile.lifecycle.effectApproved",
  observed: "mobile.lifecycle.effectObserved",
};
export function ReviewedOutcome({ entry }: { readonly entry: Schemas["ReviewHistoryEntry"] }) {
  const t = useT();
  return (
    <View accessibilityLiveRegion="polite">
      <AppText variant="h2" accessibilityRole="header">
        {t("mobile.lifecycle.reviewedTitle")}
      </AppText>
      <AppText>{t(EFFECT[entry.effect_state])}</AppText>
      <AppText>{entry.reason || t("mobile.lifecycle.decisionReasonUnknown")}</AppText>
      <AppText>{entry.decided_at}</AppText>
      {entry.approval_current === false ? (
        <AppText>{t("mobile.lifecycle.approvalNotCurrent")}</AppText>
      ) : null}
      {entry.is_terminal === false ? (
        <AppText>{t("mobile.lifecycle.nonterminalDecision")}</AppText>
      ) : null}
    </View>
  );
}
