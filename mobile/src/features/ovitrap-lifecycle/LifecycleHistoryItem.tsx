import { CorrectionHistory } from "./CorrectionHistory.tsx";
import { View } from "react-native";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { catalogLabel } from "../ovitrap-check/labels.ts";
import { KIND_LABEL, RECOVERY_LABEL } from "./labels.ts";
import { ProposalFeedback } from "./ProposalFeedback.tsx";
import type { HistoryItem } from "./types.ts";
export function LifecycleHistoryItem({ item }: { readonly item: HistoryItem }) {
  const t = useT();
  const locale = useLocale();
  const draft = item.draft;
  const reason = draft.catalog?.[draft.kind].find((choice) => choice.code === draft.reasonCode);
  return (
    <View>
      <AppText>{t(KIND_LABEL[draft.kind])}</AppText>
      <AppText>{draft.point.code}</AppText>
      <AppText>{draft.ovitrapId}</AppText>
      <AppText>{draft.replacementId}</AppText>
      <AppText>{reason ? catalogLabel(reason, locale) : draft.reasonCode}</AppText>
      <AppText>{draft.otherText}</AppText>
      {draft.recovery ? <AppText>{t(RECOVERY_LABEL[draft.recovery])}</AppText> : null}
      <AppText>{draft.deviceTime}</AppText>
      {item.proposal ? <ProposalFeedback proposal={item.proposal} /> : null}
      <CorrectionHistory corrections={item.corrections} />
    </View>
  );
}
