import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { M08Model } from "./use-m-08.ts";
import { usePhotoCapture } from "./use-photo-capture.ts";

export function PhotoCaptureCommand({ model, eventId }: { model: M08Model; eventId: string }) {
  const t = useT();
  const capture = usePhotoCapture(model, eventId);
  return (
    <ShiftAction
      label={t("mobile.ovitrap.photo")}
      disabled={model.isBusy || model.state?.isShiftBlocked !== false || model.state.event !== null}
      onPress={capture}
    />
  );
}
