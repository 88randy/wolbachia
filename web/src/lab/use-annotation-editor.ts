import { useEffect, useReducer, useState } from "react";
import { annotationReducer, createAnnotationState } from "./annotation-state";
import { useAnnotationDraft } from "./use-annotation-draft";
import { useAnnotationUpload } from "./use-annotation-upload";
import { useAnnotationActiveTime } from "./use-annotation-active-time";
import type { LabScope } from "./lab-query";

export function useAnnotationEditor(scope: LabScope, storageKey: string) {
  const [state, dispatch] = useReducer(annotationReducer, [], createAnnotationState);
  const draft = useAnnotationDraft(storageKey);
  const upload = useAnnotationUpload(scope);
  const activeTime = useAnnotationActiveTime();
  const [original, setOriginal] = useState<{ file: File; clientId: string }>();
  const saveMarks = draft.saveMarks;
  useEffect(() => {
    if (original) saveMarks(state.marks);
  }, [original, state.marks, saveMarks]);
  const choose = (file: File, clientId: string) => {
    dispatch({ type: "reset", marks: [] });
    setOriginal({ file, clientId });
    activeTime.start();
    void draft.save({ version: 1, file, clientId, marks: [] });
    void upload.upload(file, clientId);
  };
  const recover = () => {
    const recovered = draft.recoverable;
    if (!recovered) return;
    dispatch({ type: "reset", marks: recovered.marks });
    setOriginal({ file: recovered.file, clientId: recovered.clientId });
    activeTime.start();
    void upload.upload(recovered.file, recovered.clientId);
    draft.closeRecovery();
  };
  return { state, dispatch, draft, upload, original, choose, recover, activeTime };
}
