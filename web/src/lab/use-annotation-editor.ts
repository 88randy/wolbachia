import { useEffect, useReducer, useState } from "react";
import { annotationReducer, createAnnotationState } from "./annotation-state";
import { useAnnotationDraft } from "./use-annotation-draft";
import { useAnnotationUpload } from "./use-annotation-upload";
import type { LabScope } from "./lab-query";

export function useAnnotationEditor(scope: LabScope, storageKey: string) {
  const [state, dispatch] = useReducer(annotationReducer, [], createAnnotationState);
  const draft = useAnnotationDraft(storageKey);
  const upload = useAnnotationUpload(scope);
  const [original, setOriginal] = useState<{ file: File; clientId: string }>();
  const save = draft.save;
  useEffect(() => {
    if (original) void save({ version: 1, ...original, marks: state.marks });
  }, [original, state.marks, save]);
  const choose = (file: File, clientId: string) => {
    setOriginal({ file, clientId });
    void upload.upload(file, clientId);
  };
  const recover = () => {
    const recovered = draft.recoverable;
    if (!recovered) return;
    dispatch({ type: "replace", marks: recovered.marks });
    choose(recovered.file, recovered.clientId);
    draft.closeRecovery();
  };
  return { state, dispatch, draft, upload, original, choose, recover };
}
