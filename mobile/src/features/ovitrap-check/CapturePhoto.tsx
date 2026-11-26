import { Camera } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import type { CaptureProps } from "./model.ts";
import { PhotoThumb } from "./PhotoThumb.tsx";
import { usePhotoCapture } from "./use-photo-capture.ts";

/** Photo button with the photos already taken as thumbnails; each one can be deleted or retaken. */
export function CapturePhoto({ model, draft }: CaptureProps) {
  const t = useT();
  const capture = usePhotoCapture(model, draft.eventId);
  const isBlocked =
    model.isBusy || model.state?.isShiftBlocked !== false || model.state.event !== null;
  return (
    <>
      {draft.evidence.map((photo, index) => (
        <PhotoThumb
          key={photo.id}
          uri={photo.fileRef}
          number={index + 1}
          disabled={isBlocked}
          onDelete={() => {
            void model.run(() => model.service.undoEvidence(draft.eventId, photo.id), {
              eventId: draft.eventId,
            });
          }}
        />
      ))}
      <SecondaryButton
        icon={Camera}
        label={t(draft.evidence.length ? "field.open.photoAgain" : "field.open.photoTake")}
        disabled={isBlocked}
        onPress={capture}
      />
      {draft.evidence.length > 0 ? (
        <InfoNotice tone="success" message={t("field.open.photoSaved")} />
      ) : null}
    </>
  );
}
