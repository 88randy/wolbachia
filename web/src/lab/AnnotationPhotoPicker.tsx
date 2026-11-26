import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Camera, FolderOpen } from "lucide-react";
import { AnnotationFilePicker } from "./AnnotationFilePicker";
import { useAnnotationCamera } from "./use-annotation-camera";
import styles from "./annotation-upload.module.css";

export function AnnotationPhotoPicker(props: { isBusy: boolean; onChoose: (file?: File) => void }) {
  const id = useId();
  const { t } = useTranslation();
  const hasCamera = useAnnotationCamera();
  return (
    <>
      <p id={id}>{t("labAnnotation.upload.hint")}</p>
      <div className={styles.actions}>
        <AnnotationFilePicker
          {...props}
          descriptionId={id}
          inputLabel={t("labAnnotation.upload.picker")}
          label={t("labAnnotation.upload.choose")}
          icon={<FolderOpen aria-hidden="true" />}
        />
        {hasCamera && (
          <AnnotationFilePicker
            {...props}
            descriptionId={id}
            capture="environment"
            inputLabel={t("labAnnotation.upload.camera")}
            label={t("labAnnotation.upload.camera")}
            icon={<Camera aria-hidden="true" />}
          />
        )}
      </div>
    </>
  );
}
