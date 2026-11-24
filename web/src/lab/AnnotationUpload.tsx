import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import type { useAnnotationUpload } from "./use-annotation-upload";
import { AnnotationPhotoPicker } from "./AnnotationPhotoPicker";
import { AnnotationUploadChoice } from "./AnnotationUploadChoice";
import { AnnotationUploadStatus } from "./AnnotationUploadStatus";
import styles from "./annotation.module.css";
interface Props {
  upload: ReturnType<typeof useAnnotationUpload>;
  onChoose: (file: File, clientId: string) => void;
  original?: { file: File; clientId: string };
  canUpload: boolean;
}
export function AnnotationUpload({ upload, onChoose, original, canUpload }: Props) {
  const { t } = useTranslation();
  const [selection, setSelected] = useState<{ file: File; clientId: string }>();
  const selected = selection ?? original;
  const choose = (file?: File) => {
    if (file && !upload.isBusy && canUpload) setSelected({ file, clientId: crypto.randomUUID() });
  };
  return (
    <section
      className={styles.upload}
      onDragOver={allowPhotoDrop}
      onDrop={(event) => {
        event.preventDefault();
        choose(event.dataTransfer.files[0]);
      }}
    >
      <h2>{t("labAnnotation.upload.title")}</h2>
      {!canUpload && <p>{t("labAnnotation.upload.permission")}</p>}
      <AnnotationPhotoPicker isBusy={upload.isBusy || !canUpload} onChoose={choose} />
      <AnnotationUploadChoice
        selected={selected}
        isBusy={upload.isBusy}
        isAllowed={canUpload}
        onChoose={onChoose}
      />
      <AnnotationUploadStatus upload={upload} />
    </section>
  );
}

function allowPhotoDrop(event: DragEvent<HTMLElement>) {
  event.preventDefault();
}
