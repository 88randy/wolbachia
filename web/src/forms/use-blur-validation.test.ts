import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useBlurValidation } from "./use-blur-validation";
test("fields wait for blur, then revalidate changes after the first error", () => {
  const { result } = renderHook(() =>
    useBlurValidation((value) => (value.length > 0 ? undefined : "Required")),
  );
  act(() => {
    result.current.onChange("");
  });
  expect(result.current.error).toBeUndefined();
  act(() => {
    result.current.onBlur("");
  });
  expect(result.current.error).toBe("Required");
  act(() => {
    result.current.onChange("draft");
  });
  expect(result.current.error).toBeUndefined();
  act(() => {
    result.current.onChange("");
  });
  expect(result.current.error).toBe("Required");
});
