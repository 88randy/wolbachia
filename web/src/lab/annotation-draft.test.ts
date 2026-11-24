import { afterEach, expect, test, vi } from "vitest";
import {
  annotationDraftGeneration,
  purgeAnnotationDrafts,
  writeAnnotationDraft,
  writeAnnotationDraftMarks,
} from "./annotation-draft";

afterEach(() => vi.unstubAllGlobals());

test("session purge fences both queued and later saves from the retired editor", async () => {
  const deleted = { onsuccess: () => undefined };
  const open = vi.fn();
  vi.stubGlobal("indexedDB", {
    open,
    deleteDatabase: () => {
      queueMicrotask(() => {
        deleted.onsuccess();
      });
      return deleted;
    },
  });
  const previous = annotationDraftGeneration();
  const draft = {
    version: 1 as const,
    file: new File(["photo"], "photo.png"),
    clientId: crypto.randomUUID(),
    marks: [],
  };
  const pending = writeAnnotationDraft("old", draft, previous);
  const purge = purgeAnnotationDrafts();
  await Promise.all([pending, purge]);
  await writeAnnotationDraftMarks("old", [], previous);
  await writeAnnotationDraft("old", draft, previous);
  expect(open).not.toHaveBeenCalled();
});
