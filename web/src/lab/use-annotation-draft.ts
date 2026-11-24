import { useCallback, useEffect, useRef, useState } from "react";
import { readAnnotationDraft, writeAnnotationDraft } from "./annotation-draft";
import type { AnnotationDraft } from "./annotation-draft";
function useRecoverableDraft(key: string) {
  const [recoverable, setRecoverable] = useState<AnnotationDraft>();
  const [status, setStatus] = useState<"saved" | "failed">();
  const [isReady, setReady] = useState(false);
  useEffect(() => {
    let isCurrent = true;
    void readAnnotationDraft(key)
      .then((draft) => {
        if (isCurrent) {
          setRecoverable(draft);
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        console.warn("Unable to read annotation draft", error);
        if (isCurrent) {
          setStatus("failed");
          setReady(true);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [key]);
  return { recoverable, setRecoverable, status, setStatus, isReady };
}
/** A stable callback serializes saves and the final clear, preventing old save resurrection. */
export function useAnnotationDraft(key: string) {
  const recovery = useRecoverableDraft(key);
  const setStatus = recovery.setStatus;
  const writeTail = useRef(Promise.resolve());
  const save = useCallback(
    (draft: AnnotationDraft | null) => {
      writeTail.current = writeTail.current
        .then(() => writeAnnotationDraft(key, draft))
        .then(() => {
          setStatus("saved");
        })
        .catch((error: unknown) => {
          console.warn("Unable to save annotation draft", error);
          setStatus("failed");
        });
      return writeTail.current;
    },
    [key, setStatus],
  );
  return {
    ...recovery,
    save,
    closeRecovery: () => {
      recovery.setRecoverable(undefined);
    },
  };
}
