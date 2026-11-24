import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useAnnotationDraft } from "./use-annotation-draft";
import { writeAnnotationDraft, writeAnnotationDraftMarks } from "./annotation-draft";

vi.mock("./annotation-draft", () => ({
  readAnnotationDraft: () => Promise.resolve(undefined),
  writeAnnotationDraft: vi.fn(() => Promise.resolve()),
  writeAnnotationDraftMarks: vi.fn(() => Promise.resolve()),
  annotationDraftGeneration: () => 0,
}));
const draft = {
  version: 1 as const,
  file: new File(["photo"], "photo.png", { type: "image/png" }),
  clientId: "00000000-0000-4000-8000-000000000033",
  marks: [],
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

test("writes the chosen image once and debounces only mark changes", async () => {
  const { result } = renderHook(() => useAnnotationDraft("draft"));
  await act(() => result.current.save(draft));
  act(() => {
    result.current.saveMarks([{ kind: "point", x: 1, y: 2 }]);
    result.current.saveMarks([{ kind: "point", x: 3, y: 4 }]);
  });
  expect(writeAnnotationDraftMarks).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(writeAnnotationDraft).toHaveBeenCalledTimes(1);
  expect(writeAnnotationDraftMarks).toHaveBeenCalledExactlyOnceWith(
    "draft",
    [{ kind: "point", x: 3, y: 4 }],
    0,
  );
});

test("pagehide flushes marks immediately and finish prevents later resurrection", async () => {
  const { result, unmount } = renderHook(() => useAnnotationDraft("draft"));
  await act(() => result.current.save(draft));
  act(() => {
    result.current.saveMarks([{ kind: "point", x: 1, y: 2 }]);
  });
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
    await Promise.resolve();
  });
  expect(writeAnnotationDraftMarks).toHaveBeenCalledTimes(1);
  act(() => {
    result.current.saveMarks([{ kind: "point", x: 3, y: 4 }]);
  });
  await act(() => result.current.save(null));
  unmount();
  await vi.runAllTimersAsync();
  expect(writeAnnotationDraft).toHaveBeenLastCalledWith("draft", null, 0);
  expect(writeAnnotationDraftMarks).toHaveBeenCalledTimes(1);
});

test("metadata writes cannot claim draft recovery after the photo failed to persist", async () => {
  vi.mocked(writeAnnotationDraft).mockRejectedValueOnce(new Error("Photo storage unavailable"));
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const { result } = renderHook(() => useAnnotationDraft("draft"));
  await act(() => result.current.save(draft));
  act(() => {
    result.current.saveMarks([{ kind: "point", x: 1, y: 2 }]);
  });
  await act(() => vi.advanceTimersByTimeAsync(500));
  expect(result.current.status).toBe("failed");
  await act(() => result.current.save(draft));
  expect(result.current.status).toBe("saved");
  warning.mockRestore();
});
