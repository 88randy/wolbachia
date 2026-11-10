import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { CapturePhoto } from "./CapturePhoto.tsx";
import { capturePages } from "./capture-pages.ts";
import { CaptureSummary } from "./CaptureSummary.tsx";
import { RepeatBlock } from "./RepeatBlock.tsx";
import { ReviewBlock } from "./ReviewBlock.tsx";
import type { CaptureProps } from "./model.ts";
import { requiresPhoto, saveGate } from "./validation.ts";

/** Last page: the answers, why the office may review it, and what is still missing to save. */
export function ConfirmPage(props: CaptureProps) {
  const { model, draft } = props;
  const t = useT();
  const gate = saveGate(draft, new Date());
  const needsPhotoHere = requiresPhoto(draft) && !capturePages(draft).includes("photo");
  return (
    <>
      <StepQuestion title={t("field.capture.confirmQuestion")} />
      {model.state?.isBagReserved ? (
        <InfoNotice tone="warning" message={t("field.capture.bagTaken")} />
      ) : null}
      <CaptureSummary draft={draft} />
      {needsPhotoHere ? <CapturePhoto {...props} /> : null}
      <RepeatBlock {...props} />
      <ReviewBlock {...props} />
      {gate && gate !== "review" ? (
        <InfoNotice tone="warning" message={t(`field.capture.gate.${gate}`)} />
      ) : null}
    </>
  );
}
