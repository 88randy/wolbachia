import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { CapturePhoto } from "./CapturePhoto.tsx";
import type { CaptureProps } from "./model.ts";

/** "Toma una foto": needed for some findings, and for the placed trap. Its own page so it is never missed. */
export function PhotoPage(props: CaptureProps) {
  const t = useT();
  const isPlace = props.draft.mode === "place";
  return (
    <>
      <StepQuestion
        title={t(isPlace ? "field.capture.photoPlaceQuestion" : "field.capture.photoQuestion")}
        hint={t(isPlace ? "field.capture.photoPlaceHint" : "field.capture.photoHint")}
      />
      <CapturePhoto {...props} />
    </>
  );
}
