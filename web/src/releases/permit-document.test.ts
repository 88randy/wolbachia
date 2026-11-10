import { expect, test } from "vitest";
import { messages } from "@wolbachia/i18n";
import { PERMIT_DOCUMENT_ACCEPT, permitDocumentProblem, uploadErrorKey } from "./permit-document";

test("accepts PDF, JPEG and PNG only", () => {
  expect(PERMIT_DOCUMENT_ACCEPT).toBe("application/pdf,image/jpeg,image/png");
  expect(permitDocumentProblem({ type: "application/pdf", size: 10 })).toBeUndefined();
  expect(permitDocumentProblem({ type: "image/png", size: 10 })).toBeUndefined();
  expect(permitDocumentProblem({ type: "image/gif", size: 10 })).toBe("invalidType");
  expect(permitDocumentProblem({ type: "application/pdf", size: 0 })).toBe("empty");
});

test("rejects an oversized file before upload using the backend limit", () => {
  expect(permitDocumentProblem({ type: "application/pdf", size: 11 * 1024 * 1024 })).toBe(
    "tooLarge",
  );
});

test("every upload error code resolves to a key translated in es-MX and en", () => {
  const codes = [
    "upload_content_mismatch",
    "upload_invalid_pdf",
    "upload_pdf_encrypted",
    "upload_type_not_allowed",
    "upload_too_large",
  ];
  for (const code of codes) {
    const key = uploadErrorKey(code) as keyof (typeof messages)["es-MX"];
    expect(key).toBeDefined();
    expect(messages["es-MX"][key]).toBeTruthy();
    expect(messages.en[key]).toBeTruthy();
  }
});
