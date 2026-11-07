import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { LifecycleHistoryItem } from "./LifecycleHistoryItem.tsx";
import type { M09Model } from "./use-m-09.ts";
import { RemoteProposalFeedback } from "./RemoteProposalFeedback.tsx";
export function LifecycleHistory({ model }: { readonly model: M09Model }) {
  const t = useT();
  return (
    <View>
      <AppText variant="h2" accessibilityRole="header">
        {t("mobile.lifecycle.history")}
      </AppText>
      {model.state?.history.map((item) => (
        <LifecycleHistoryItem key={item.draft.eventId} item={item} />
      ))}
      {model.state?.remoteProposals?.map((entry) => (
        <RemoteProposalFeedback key={entry.id} entry={entry} />
      ))}
    </View>
  );
}
