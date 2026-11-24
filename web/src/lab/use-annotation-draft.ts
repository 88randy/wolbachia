import { useEffect, useState } from "react";
import {
  annotationDraftGeneration,
  readAnnotationDraft,
  writeAnnotationDraft,
  writeAnnotationDraftMarks,
} from "./annotation-draft";
import type { AnnotationDraft } from "./annotation-draft";
import type { AnnotationMark } from "./annotation-state";
const DRAFT_DEBOUNCE_MS = 500;
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
interface DraftWriter {
  key: string;
  generation: number;
  pending?: AnnotationMark[];
  timer?: ReturnType<typeof setTimeout>;
  isCleared: boolean;
  setStatus: (status: "saved" | "failed") => void;
}
function finishDraftWrite(writer: DraftWriter, write: Promise<void>) {
  return write
    .then(() => {
      writer.setStatus("saved");
    })
    .catch((error: unknown) => {
      console.warn("Unable to save annotation draft", error);
      writer.setStatus("failed");
    });
}
function flushDraft(writer: DraftWriter) {
  clearTimeout(writer.timer);
  const marks = writer.pending;
  writer.pending = undefined;
  if (!marks || writer.isCleared) return Promise.resolve();
  return finishDraftWrite(writer, writeAnnotationDraftMarks(writer.key, marks, writer.generation));
}
function saveDraft(writer: DraftWriter, draft: AnnotationDraft | null) {
  clearTimeout(writer.timer);
  writer.pending = undefined;
  writer.isCleared = draft === null;
  return finishDraftWrite(writer, writeAnnotationDraft(writer.key, draft, writer.generation));
}
function scheduleDraftMarks(writer: DraftWriter, marks: AnnotationMark[]) {
  if (writer.isCleared) return;
  writer.pending = marks;
  clearTimeout(writer.timer);
  writer.timer = setTimeout(() => {
    void flushDraft(writer);
  }, DRAFT_DEBOUNCE_MS);
}
function createDraftWriter(key: string, setStatus: DraftWriter["setStatus"]) {
  const writer: DraftWriter = {
    key,
    generation: annotationDraftGeneration(),
    setStatus,
    isCleared: false,
  };
  return {
    save: (draft: AnnotationDraft | null) => saveDraft(writer, draft),
    saveMarks: (marks: AnnotationMark[]) => {
      scheduleDraftMarks(writer, marks);
    },
    flush: () => flushDraft(writer),
  };
}

/** Only mark metadata is debounced; a final clear cancels pending work before navigation. */
export function useAnnotationDraft(key: string) {
  const recovery = useRecoverableDraft(key);
  const [writer] = useState(() => createDraftWriter(key, recovery.setStatus));
  useEffect(() => {
    const onPageHide = () => {
      void writer.flush();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      void writer.flush();
    };
  }, [writer]);
  return {
    ...recovery,
    ...writer,
    closeRecovery: () => {
      recovery.setRecoverable(undefined);
    },
  };
}
