import { useTranslation } from "react-i18next";
import { AnnotationUploadFailure } from "./AnnotationUploadFailure";
import type { useAnnotationUpload } from "./use-annotation-upload";
export function AnnotationUploadStatus({
  upload,
}: {
  upload: ReturnType<typeof useAnnotationUpload>;
}) {
  const { t } = useTranslation();
  const completed = upload.stage === "preparing" ? 0 : upload.stage === "sending" ? 1 : 2;
  return (
    <div role="status" aria-atomic="true">
      {upload.stage && (
        <>
          <p>{t(`labAnnotation.upload.${upload.stage}`)}</p>
          <progress max={3} value={completed} aria-label={t("labAnnotation.upload.progress")} />
        </>
      )}
      {upload.failure && <AnnotationUploadFailure failure={upload.failure} />}
    </div>
  );
}
