import { View } from "react-native";
import { PhotoCaptureCommand } from "./PhotoCaptureCommand.tsx";
import { PendingPhoto } from "./PendingPhoto.tsx";
import type { CaptureProps } from "./model.ts";
export function EvidenceCapture({ model, draft }: CaptureProps) {
  return (
    <View>
      {draft.evidence.map((item) => (
        <PendingPhoto key={item.id} model={model} eventId={draft.eventId} photo={item} />
      ))}
      <PhotoCaptureCommand eventId={draft.eventId} model={model} />
    </View>
  );
}
