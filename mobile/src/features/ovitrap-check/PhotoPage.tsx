import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { CapturePhoto } from "./CapturePhoto.tsx";
import type { CaptureProps } from "./model.ts";

/** "Toma una foto": needed for some findings. Shown as its own page so it is never missed. */
export function PhotoPage(props: CaptureProps) {
  const t = useT();
  return (
    <>
      <StepQuestion title={t("field.capture.photoQuestion")} hint={t("field.capture.photoHint")} />
      <CapturePhoto {...props} />
    </>
  );
}
