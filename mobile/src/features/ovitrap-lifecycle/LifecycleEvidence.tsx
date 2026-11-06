import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { LifecycleCommand } from "./LifecycleCommand.tsx";
import { EvidenceRow } from "./EvidenceRow.tsx";
import type { LifecycleProps } from "./model.ts";
export function LifecycleEvidence(props: LifecycleProps) {
  const { draft, model } = props;
  const t = useT();
  return (
    <View>
      <AppText>{t("mobile.lifecycle.photoRequired")}</AppText>
      <LifecycleCommand model={model} eventId={draft.eventId} command="captureEvidence" />
      {draft.evidence.map((item) => (
        <EvidenceRow key={item.id} id={item.id} {...props} />
      ))}
      {draft.discardedEvidence.length ? (
        <View accessibilityLiveRegion="polite">
          <AppText>{t("mobile.lifecycle.photoDiscarded")}</AppText>
          <LifecycleCommand model={model} eventId={draft.eventId} command="undoEvidence" />
        </View>
      ) : null}
    </View>
  );
}
