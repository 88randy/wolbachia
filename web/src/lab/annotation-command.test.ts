import { beforeEach, expect, test } from "vitest";
import { buildAnnotationCount, buildAnnotationReplacement } from "./annotation-command";

const options = {
  storageKey: "annotation:test",
  revision: 1,
  context: {},
  uploadId: "00000000-0000-4000-8000-000000000033",
  marks: [],
  elapsedSeconds: 23,
};
beforeEach(() => {
  sessionStorage.clear();
});

test("replacement writes only its own command signature", () => {
  buildAnnotationReplacement(
    options,
    { id: "count", reason: "Correct observation", code: "other" },
    false,
  );
  expect(sessionStorage.getItem(options.storageKey + ":command")).toBeNull();
  expect(sessionStorage.getItem(options.storageKey + ":replacement-command")).not.toBeNull();
});

test("the annotation records active elapsed seconds", () => {
  expect(buildAnnotationCount(options, false).annotation?.elapsed_seconds).toBe(23);
});
