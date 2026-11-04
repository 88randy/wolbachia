import { describe, expect, test } from "vitest";
import { passwordMessageKey } from "./request-password-reset-confirm";

function envelope(codes: string[]) {
  return {
    code: "validation_error",
    detail: "Invalid.",
    fields: { new_password: codes.map((code) => ({ code, params: {} })) },
  };
}

describe("passwordMessageKey", () => {
  test("uses the first validator code the catalog knows", () => {
    expect(passwordMessageKey(envelope(["something_new", "password_too_common"]))).toBe(
      "auth.reset.passwordTooCommon",
    );
  });

  test("falls back to the generic validation message", () => {
    expect(passwordMessageKey(envelope(["something_new"]))).toBe("errors.api.validation");
    expect(passwordMessageKey({ code: "validation_error", detail: "Invalid." })).toBe(
      "errors.api.validation",
    );
  });
});
