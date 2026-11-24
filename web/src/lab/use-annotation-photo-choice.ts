import { useState, type DragEvent } from "react";
import { isAnnotationPhoto } from "./annotation-upload";
import type { useAnnotationUpload } from "./use-annotation-upload";

interface ChoiceOptions {
  upload: ReturnType<typeof useAnnotationUpload>;
  onChoose: (file: File, clientId: string) => void;
  original?: { file: File; clientId: string };
  canUpload: boolean;
}

/** A valid selection starts uploading immediately; retries retain the upload identity. */
export function useAnnotationPhotoChoice(options: ChoiceOptions) {
  const [selection, setSelected] = useState<ChoiceOptions["original"]>();
  const [isInvalid, setInvalid] = useState(false);
  const choose = (file?: File) => {
    if (!file || options.upload.isBusy || !options.canUpload) return;
    const isValid = isAnnotationPhoto(file);
    setInvalid(!isValid);
    if (!isValid) return;
    const selected = { file, clientId: crypto.randomUUID() };
    setSelected(selected);
    options.onChoose(selected.file, selected.clientId);
  };
  const dropzone = usePhotoDrop({ choose, isAllowed: options.canUpload && !options.upload.isBusy });
  return { selected: selection ?? options.original, choose, isInvalid, dropzone };
}

function usePhotoDrop(options: { choose: (file?: File) => void; isAllowed: boolean }) {
  const [isDragging, setDragging] = useState(false);
  return {
    "data-drag-over": isDragging || undefined,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(options.isAllowed);
    },
    onDragLeave: () => {
      setDragging(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      options.choose(event.dataTransfer.files[0]);
    },
  };
}
