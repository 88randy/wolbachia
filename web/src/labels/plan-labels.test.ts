import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_COPIES, MAX_LABELS } from "./label-formats";
import { readLabelPreferences, saveLabelPreferences } from "./label-preferences";
import { qrContent } from "./label-record";
import type { LabelRecord } from "./label-record";
import { paginate, parseCopies, planLabels } from "./plan-labels";

const record = (code: string): LabelRecord => ({ kind: "lot", id: code, code, lines: [] });

describe("parseCopies", () => {
  it("keeps whole numbers inside the allowed range", () => {
    expect(parseCopies("3")).toBe(3);
    expect(parseCopies(String(MAX_COPIES + 20))).toBe(MAX_COPIES);
  });
  it("counts anything else as one copy", () => {
    expect(parseCopies("")).toBe(1);
    expect(parseCopies("0")).toBe(1);
    expect(parseCopies("-4")).toBe(1);
    expect(parseCopies("abc")).toBe(1);
  });
});

describe("planLabels and paginate", () => {
  it("repeats each record, keeping the copies of one record together", () => {
    const plan = planLabels([record("A"), record("B")], 2);
    expect(plan.labels.map((label) => label.code)).toEqual(["A", "A", "B", "B"]);
    expect(plan.isTruncated).toBe(false);
  });
  it("cuts a job that is too long and says so", () => {
    const many = Array.from({ length: MAX_LABELS + 5 }, (_, index) => record(`L-${String(index)}`));
    const plan = planLabels(many, 1);
    expect(plan.labels).toHaveLength(MAX_LABELS);
    expect(plan.isTruncated).toBe(true);
  });
  it("splits labels into printed pages", () => {
    const pages = paginate(
      Array.from({ length: 31 }, (_, index) => record(String(index))),
      30,
    );
    expect(pages.map((page) => page.length)).toEqual([30, 1]);
  });
});

describe("qrContent", () => {
  const id = "0A1B2C3D-0000-4000-8000-0123456789AB";
  it("carries the lowercase id for the kinds the phone matches by id (lot, bag, ovitrap)", () => {
    for (const kind of ["lot", "bag", "ovitrap"] as const)
      expect(qrContent({ kind, id, code: "X-42", lines: [] })).toBe(
        `wbf:1:${kind}:0a1b2c3d-0000-4000-8000-0123456789ab`,
      );
  });
  it("carries the human code for paddles, motorcycles and locations", () => {
    for (const kind of ["paddle", "motorcycle", "location"] as const)
      expect(qrContent({ kind, id, code: "X-42", lines: ["Insumo"] })).toBe(`wbf:1:${kind}:X-42`);
  });
  it("every kind the phone parser reads has a payload its patterns accept", () => {
    const byId =
      /^wbf:1:(lot|ovitrap|bag):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const byCode = /^wbf:1:(paddle|motorcycle):[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/;
    expect(qrContent({ kind: "lot", id, code: "L-1", lines: [] })).toMatch(byId);
    expect(qrContent({ kind: "paddle", id, code: "P-7", lines: [] })).toMatch(byCode);
    expect(qrContent({ kind: "motorcycle", id, code: "M-03", lines: [] })).toMatch(byCode);
  });
});

describe("label preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });
  it("remembers the last format and copies", () => {
    saveLabelPreferences({ format: "letter3x10", copies: 4 });
    expect(readLabelPreferences()).toEqual({ format: "letter3x10", copies: 4 });
  });
  it("falls back to defaults on garbage", () => {
    window.localStorage.setItem("wolbachia.labelPrint", "{not json");
    expect(readLabelPreferences()).toEqual({ format: "thermal50x25", copies: 1 });
    window.localStorage.setItem(
      "wolbachia.labelPrint",
      JSON.stringify({ format: "huge", copies: 999 }),
    );
    expect(readLabelPreferences()).toEqual({ format: "thermal50x25", copies: 1 });
  });
  it("survives a blocked storage", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readLabelPreferences().format).toBe("thermal50x25");
    expect(() => {
      saveLabelPreferences({ format: "thermal62x29", copies: 2 });
    }).not.toThrow();
  });
});
