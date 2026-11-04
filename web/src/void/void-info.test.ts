import { describe, expect, test } from "vitest";
import { makeMe } from "../test/fake-api";
import { countCharacters } from "./count-characters";
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
      void_reason: "Folio duplicado",
    };

    expect(voidInfoOf(record, authorLabel)).toEqual({
      reason: "Folio duplicado",
      author: "user u1",
    });
    expect(voidInfoOf(record, authorLabel, (iso) => iso.slice(0, 10))).toEqual({
      reason: "Folio duplicado",
      author: "user u1",
      when: "2026-09-12",
    });
  });
});

describe("countCharacters", () => {
  test("counts code points like Python's len", () => {
    expect(countCharacters("")).toBe(0);
    expect(countCharacters("anulación")).toBe(9);
    expect(countCharacters("😀a")).toBe(2);
  });
});

describe("voidLimitsOf", () => {
  test("takes the limits from /me/", () => {
    const me = makeMe({ limits: { void_reason_min_length: 20, void_reason_max_length: 500 } });

    expect(voidLimitsOf(me)).toEqual({ minLength: 20, maxLength: 500 });
  });
});
