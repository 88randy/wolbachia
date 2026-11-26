import { useEffect, useRef, useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { chooseAnnotationPhoto } from "./annotation-photo-file";
import { usePhotoDrop } from "./use-photo-drop";
import type { useAnnotationUpload } from "./use-annotation-upload";

interface ChoiceOptions {
  upload: ReturnType<typeof useAnnotationUpload>;
  onChoose: (file: File, clientId: string) => void;
  original?: { file: File; clientId: string };
  canUpload: boolean;
}

function usePhotoChoiceState(options: ChoiceOptions) {
  const [selection, setSelected] = useState<ChoiceOptions["original"]>();
  const [error, setError] = useState<MessageKey>();
  const [hasMultiple, setMultiple] = useState(false);
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current += 1;
    },
    [options.canUpload, options.upload.isBusy],
  );
  const chooseFiles = async (files: File[]) => {
    if (options.upload.isBusy || !options.canUpload) return;
    const attempt = ++version.current;
    const choice = await chooseAnnotationPhoto(files).catch(() => ({
      error: "labAnnotation.upload.invalidImage" as const,
    }));
    if (attempt !== version.current) return;
    setError(choice.error);
    setMultiple(!choice.error && files.length > 1);
    if (choice.error) return;
    const selected = { file: choice.file, clientId: crypto.randomUUID() };
    setSelected(selected);
    options.onChoose(selected.file, selected.clientId);
  };
  return { selected: selection ?? options.original, error, hasMultiple, chooseFiles };
}

/** A valid selection starts uploading immediately; retries retain the upload identity. */
export function useAnnotationPhotoChoice(options: ChoiceOptions) {
  const { chooseFiles, ...choice } = usePhotoChoiceState(options);
  const isDragging = usePhotoDrop({
    chooseFiles: (files) => {
      void chooseFiles(files);
    },
    isAllowed: options.canUpload && !options.upload.isBusy,
  });
  return {
    ...choice,
    isDragging,
    choose: (file?: File) => {
      if (file) void chooseFiles([file]);
    },
  };
}
