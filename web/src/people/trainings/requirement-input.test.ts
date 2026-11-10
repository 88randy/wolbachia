import { expect, test } from "vitest";
import { requirementBody } from "./requirement-input";
const FIRST = "00000000-0000-4000-8000-000000000401";
const SECOND = "00000000-0000-4000-8000-000000000402";
const V1 = "00000000-0000-4000-8000-000000000403";
const V2 = "00000000-0000-4000-8000-000000000404";
const NEW = "00000000-0000-4000-8000-000000000405";
const CONTEXT = { subject: "", center: FIRST, quadrant: "", action: "release.record", at: "" };
test("updating one required course preserves every other course and the reviewed revision", () => {
  const original = { [FIRST]: [V1], [SECOND]: [V2] };
  const body = requirementBody(
    { training: FIRST, versions: NEW, effective_from: "2026-11-09T12:00:00Z" },
    { context: CONTEXT, revision: 8, existing: original },
  );
  expect(body.acceptable_versions).toEqual({ [FIRST]: [NEW], [SECOND]: [V2] });
  expect(body.expected_revision).toBe(8);
  expect(original).toEqual({ [FIRST]: [V1], [SECOND]: [V2] });
});
test("unreadable retained requirement pins fail closed before publication", () => {
  expect(() =>
    requirementBody(
      { training: FIRST, versions: NEW },
      { context: CONTEXT, revision: 8, existing: { [SECOND]: [1] } },
    ),
  ).toThrow("Unsupported requirement pins");
});
