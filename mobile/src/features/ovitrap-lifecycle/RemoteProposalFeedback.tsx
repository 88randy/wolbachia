import { View } from "react-native";
import type { Schemas } from "@wolbachia/api-client";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ProposalFeedback } from "./ProposalFeedback.tsx";
import { historyProposal } from "./proposal-model.ts";
export function RemoteProposalFeedback({
  entry,
}: {
  readonly entry: Schemas["RelocationHistoryEntry"];
}) {
  const t = useT();
  return (
    <View>
      <AppText>{t("mobile.lifecycle.remoteProposal")}</AppText>
      <AppText>{entry.point_code}</AppText>
      <AppText>{entry.id}</AppText>
      <ProposalFeedback proposal={historyProposal(entry)} />
    </View>
  );
}
