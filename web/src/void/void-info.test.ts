import { describe, expect, test } from "vitest";
import { makeMe } from "../test/fake-api";
import { voidInfoOf } from "./void-info";
import { voidLimitsOf } from "./void-limits";

const authorLabel = (id: string | null) => (id === null ? "?" : `user ${id}`);

describe("voidInfoOf", () => {
  test("is null for a record that is not voided", () => {
    expect(
      voidInfoOf({ voided_at: null, voided_by: null, void_reason: "" }, authorLabel),
    ).toBeNull();
    expect(voidInfoOf({}, authorLabel)).toBeNull();
  });

  test("reads reason and author, and formats the date only when asked", () => {
    const record = {
      voided_at: "2026-09-12T10:00:00Z",
      voided_by: "u1",
      void_reason_code: "other",
      void_reason: "Folio duplicado",
    };

    expect(voidInfoOf(record, authorLabel)).toEqual({
      reason: "Folio duplicado",
      author: "user u1",
    });
    expect(voidInfoOf(record, authorLabel, { formatWhen: (iso) => iso.slice(0, 10) })).toEqual({
      reason: "Folio duplicado",
      author: "user u1",
      when: "2026-09-12",
    });
  });
  test.each(["", "  Same record  "])("keeps catalog reason and note separate: %j", (note) => {
    expect(
      voidInfoOf(
        {
          voided_at: "2026-09-12T10:00:00Z",
          void_reason_code: "duplicate",
          void_reason: note,
        },
        authorLabel,
        { reasonLabel: () => "Duplicate entry" },
      ),
    ).toEqual({
      reason: "Duplicate entry",
      author: "?",
      ...(note === "" ? {} : { note }),
    });
  });

  test("uses the raw code when no catalog label is available", () => {
    expect(
      voidInfoOf(
        {
          voided_at: "2026-09-12T10:00:00Z",
          void_reason_code: "old_reason",
          void_reason: "",
        },
        authorLabel,
      )?.reason,
    ).toBe("old_reason");
  });
});

describe("voidLimitsOf", () => {
  test("takes the limits from /me/", () => {
    const me = makeMe({ limits: { void_reason_min_length: 20, void_reason_max_length: 500 } });

    expect(voidLimitsOf(me)).toEqual({ minLength: 20, maxLength: 500 });
  });
});
