import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { annotationUploadError, annotationUploadParams } from "./annotation-upload-error";
export function AnnotationUploadFailure({ failure }: { failure: Schemas["FieldError"] }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <p>
        {t(annotationUploadError(failure.code), annotationUploadParams(failure, i18n.language))}
      </p>
      <details>
        <summary>{t("ui.actions.details")}</summary>
        <code>{failure.code}</code>
      </details>
    </>
  );
}
