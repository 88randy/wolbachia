import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { makeOrganization } from "../../test/fake-api";
import { useOrganizationDraft } from "./use-organization-draft";

const INITIAL = { ...makeOrganization("norte", "Programa"), revision: 4 };

test("newer organization versions synchronize a clean form while preserving pending edits and their revision", () => {
  const { result, rerender } = renderHook(useOrganizationDraft, { initialProps: INITIAL });
  const updated = { ...INITIAL, revision: 5, timezone: "UTC", label_phone: "5678" };
  rerender(updated);
  expect(result.current.settings).toEqual(updated);
  act(() => {
    result.current.change("label_phone", "1234");
  });
  rerender({ ...updated, revision: 6, timezone: "America/Cancun" });
  expect(result.current.settings).toEqual({ ...updated, label_phone: "1234" });
});

test.each(["settings", "logo"] as const)(
  "a late %s acknowledgement cannot regress a clean form that already received a newer version",
  (kind) => {
    const { result, rerender } = renderHook(useOrganizationDraft, { initialProps: INITIAL });
    const newest = { ...INITIAL, revision: 6, timezone: "UTC" };
    rerender(newest);
    act(() => {
      const accept = kind === "settings" ? result.current.accept : result.current.acceptLogo;
      accept({ ...INITIAL, revision: 5 });
    });
    expect(result.current.settings).toEqual(newest);
    expect(result.current.isSaved).toBe(false);
    expect(result.current.isLogoSaved).toBe(false);
  },
);
