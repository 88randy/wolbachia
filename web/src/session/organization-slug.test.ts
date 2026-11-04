import { beforeEach, describe, expect, test } from "vitest";
import { STORAGE_KEYS } from "../storage/safe-storage";
import {
  clearOrganizationSlug,
  getOrganizationSlug,
  setOrganizationSlug,
} from "./organization-slug";

beforeEach(() => {
  clearOrganizationSlug();
  window.localStorage.clear();
});

describe("organization slug", () => {
  test("is undefined until the user chooses one", () => {
    expect(getOrganizationSlug()).toBeUndefined();
  });

  test("a chosen slug is kept in memory and in storage", () => {
    setOrganizationSlug("norte");

    expect(getOrganizationSlug()).toBe("norte");
    expect(window.localStorage.getItem(STORAGE_KEYS.organization)).toBe("norte");
  });

  test("a stored slug survives a reload (new memory)", () => {
    window.localStorage.setItem(STORAGE_KEYS.organization, "sur");

    expect(getOrganizationSlug()).toBe("sur");
  });

  test("clearing forgets it everywhere", () => {
    setOrganizationSlug("norte");

    clearOrganizationSlug();

    expect(getOrganizationSlug()).toBeUndefined();
    expect(window.localStorage.getItem(STORAGE_KEYS.organization)).toBeNull();
  });

  test.each(["a b", "norte\r\nX-Evil: 1", "", "x".repeat(65), "norte/../sur"])(
    "a malformed stored value (%j) is ignored and dropped",
    (stored) => {
      window.localStorage.setItem(STORAGE_KEYS.organization, stored);

      expect(getOrganizationSlug()).toBeUndefined();
      expect(window.localStorage.getItem(STORAGE_KEYS.organization)).toBeNull();
    },
  );

  test("a malformed slug is never stored", () => {
    setOrganizationSlug("not a slug");

    expect(getOrganizationSlug()).toBeUndefined();
    expect(window.localStorage.getItem(STORAGE_KEYS.organization)).toBeNull();
  });
});
