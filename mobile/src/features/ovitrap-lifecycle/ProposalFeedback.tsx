import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PROPOSAL_LABEL } from "./labels.ts";
import type { RelocationProposal } from "./types.ts";
export function ProposalFeedback({ proposal }: { readonly proposal: RelocationProposal }) {
  const t = useT();
  return (
    <View>
      <AppText>{t(PROPOSAL_LABEL[proposal.status])}</AppText>
      {proposal.decision ? (
        <AppText>{proposal.decision.reason}</AppText>
      ) : (
        <AppText>{t("mobile.lifecycle.decisionPending")}</AppText>
      )}
      {proposal.nextDayTask ? (
        <View>
          <AppText>{t("mobile.lifecycle.nextTask")}</AppText>
          <AppText>{proposal.nextDayTask.code}</AppText>
          <AppText>{proposal.nextDayTask.dueDate}</AppText>
        </View>
      ) : (
        <AppText>{t("mobile.lifecycle.noTask")}</AppText>
      )}
    </View>
  );
}
