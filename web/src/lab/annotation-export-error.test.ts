import { ApiError } from "@wolbachia/api-client";
import { describe, expect, test } from "vitest";
import { exportFailure } from "./annotation-export-error";

describe("export validation feedback", () => {
  test.each([
    {
      code: "annotation_export_date_range",
      params: { max_days: 42 },
      key: "annotationExport.error.tooLong",
      formatted: { maxDays: "42" },
    },
    {
      code: "annotation_export_too_many_bytes",
      params: { max_bytes: 123456 },
      key: "annotationExport.error.tooLarge",
      formatted: { maxBytes: "123,456" },
    },
  ])("uses server limits and the culprit field for $code", ({ code, params, key, formatted }) => {
    const error = new ApiError(400, {
      code: "validation_error",
      detail: "Synthetic limit.",
      fields: { date_to: [{ code, params }] },
    });
    expect(exportFailure(error, "es-MX")).toEqual({ key, params: formatted, field: "date_to" });
  });

  test("keeps errors for unsupported fields visible as form feedback", () => {
    const error = new ApiError(400, {
      code: "validation_error",
      detail: "Synthetic author.",
      fields: { author: [{ code: "does_not_exist", params: {} }] },
    });
    expect(exportFailure(error, "es-MX")).toEqual({
      key: "annotationExport.error.failed",
      params: {},
    });
  });
});
