import { useTranslation } from "react-i18next";
import { ImageUp } from "lucide-react";
import type { useAnnotationUpload } from "./use-annotation-upload";
import { AnnotationPhotoPicker } from "./AnnotationPhotoPicker";
import { AnnotationUploadChoice } from "./AnnotationUploadChoice";
import { AnnotationUploadStatus } from "./AnnotationUploadStatus";
import { useAnnotationPhotoChoice } from "./use-annotation-photo-choice";
import styles from "./annotation-upload.module.css";
interface Props {
  upload: ReturnType<typeof useAnnotationUpload>;
  onChoose: (file: File, clientId: string) => void;
  original?: { file: File; clientId: string };
  canUpload: boolean;
}
export function AnnotationUpload({ upload, onChoose, original, canUpload }: Props) {
  const { t } = useTranslation();
  const { selected, choose, isInvalid, dropzone } = useAnnotationPhotoChoice({
    upload,
    onChoose,
    original,
    canUpload,
  });
  return (
    <section className={styles.upload} {...dropzone}>
      <ImageUp className={styles.uploadIcon} aria-hidden="true" />
      <h2>{t("labAnnotation.upload.title")}</h2>
      {!canUpload && <p>{t("labAnnotation.upload.permission")}</p>}
      <AnnotationPhotoPicker isBusy={upload.isBusy || !canUpload} onChoose={choose} />
      {isInvalid && <p role="alert">{t("labAnnotation.upload.invalid")}</p>}
      <AnnotationUploadChoice
        selected={selected}
        isBusy={upload.isBusy}
        isAllowed={canUpload}
        onChoose={onChoose}
        hasFailed={upload.failure !== undefined}
      />
      <AnnotationUploadStatus upload={upload} />
    </section>
  );
}
