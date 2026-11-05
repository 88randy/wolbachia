import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";
import { CaptureCommand } from "./CaptureCommand.tsx";
import type { CaptureProps } from "./model.ts";
export function EvidenceCapture({ model, draft }: CaptureProps) {
  return (
    <View>
      {draft.evidence.map((item) => (
        <AppText key={item.id}>{item.id}</AppText>
      ))}
      <CaptureCommand eventId={draft.eventId} model={model} command="captureEvidence" />
    </View>
  );
}
