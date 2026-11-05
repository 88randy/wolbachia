import { expect, test } from "vitest";
import { catalogCreateSchema } from "./catalog-schema";
test.each(["other", "Uppercase", "_start", "a".repeat(65)])(
  "refuses invalid or reserved create code %s",
  (code) => {
    const answer = catalogCreateSchema.safeParse({ code, label_es: "Etiqueta", label_en: "" });
    expect(answer.success).toBe(false);
    if (!answer.success && code === "other")
      expect(answer.error.issues[0]?.message).toBe("catalogs.error.reserved");
  },
);
test("permits missing English and trims labels before submission", () => {
  expect(
    catalogCreateSchema.parse({ code: "new-code_1", label_es: " Rociado ", label_en: "" }).label_es,
  ).toBe("Rociado");
});

test.each(["", "   ", "a".repeat(201)])(
  "refuses a missing or oversized Spanish label",
  (label_es) => {
    const answer = catalogCreateSchema.safeParse({ code: "valid", label_es, label_en: "" });
    expect(answer.success).toBe(false);
    if (!answer.success) expect(answer.error.issues[0]?.path).toEqual(["label_es"]);
  },
);
