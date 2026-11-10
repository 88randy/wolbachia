import { Camera, X } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { CaptureProps } from "./model.ts";
import { usePhotoCapture } from "./use-photo-capture.ts";

/** Photo button with the photos already taken; each one can be taken out again. */
export function CapturePhoto({ model, draft }: CaptureProps) {
  const t = useT();
  const capture = usePhotoCapture(model, draft.eventId);
  const isBlocked =
    model.isBusy || model.state?.isShiftBlocked !== false || model.state.event !== null;
  return (
    <>
      <SecondaryButton
        icon={Camera}
        label={t(draft.evidence.length ? "field.open.photoAgain" : "field.open.photoTake")}
        disabled={isBlocked}
        onPress={capture}
      />
      {draft.evidence.map((photo, index) => (
        <SecondaryButton
          key={photo.id}
          icon={X}
          label={t("field.lifecycle.discardPhoto", { number: index + 1 })}
          disabled={isBlocked}
          onPress={() => {
            void model.run(() => model.service.undoEvidence(draft.eventId, photo.id), {
              eventId: draft.eventId,
            });
          }}
        />
      ))}
      {draft.evidence.length > 0 ? (
        <InfoNotice tone="success" message={t("field.open.photoSaved")} />
      ) : null}
    </>
  );
}
