import { expect, test } from "vitest";
import { reasonError, validationState, canDecide } from "./shift-validation";
import { shiftDetail } from "./shift-test-helpers";

test("both decisions require visible reason text within the server limits", () => {
  const limits = { minLength: 10, maxLength: 20 };
  expect(reasonError(" \u200b  ", limits)).toBeDefined();
  expect(reasonError("short", limits)).toBeDefined();
  expect(reasonError("a".repeat(21), limits)).toBeDefined();
  expect(reasonError("Reason\u202e for audit", limits)).toBeDefined();
  expect(reasonError("  Reviewed shift  ", limits)).toBeUndefined();
});

test("lifecycle and approval freshness remain independent", () => {
  expect(validationState(shiftDetail())).toBe("pending");
  expect(validationState(shiftDetail({ status: "open" }))).toBe("open");
  const observed = { ...shiftDetail().validation, kind: "observe" as const };
  expect(validationState(shiftDetail({ validation: observed }))).toBe("observed");
  const approved = { ...observed, kind: "approve" as const, approval_current: true };
  expect(validationState(shiftDetail({ validation: approved }))).toBe("approved");
  expect(
    validationState(shiftDetail({ validation: { ...approved, approval_current: false } })),
  ).toBe("outdated");
});

test("open shifts block both actions while safety blockers only block approval", () => {
  const open = shiftDetail({ status: "open" });
  expect(canDecide(open, "approve")).toBe(false);
  expect(canDecide(open, "observe")).toBe(false);
  const blocked = shiftDetail({
    validation: { ...open.validation, blockers: ["motorcycle_safety_hold"] },
  });
  expect(canDecide(blocked, "approve")).toBe(false);
  expect(canDecide(blocked, "observe")).toBe(true);
});
