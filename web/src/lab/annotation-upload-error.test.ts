import { ApiError } from "@wolbachia/api-client";
import { expect, test } from "vitest";
import {
  annotationUploadError,
  annotationUploadFailure,
  annotationUploadParams,
} from "./annotation-upload-error";

test("uses the actionable file error and its server limit from a validation envelope", () => {
  const error = new ApiError(400, {
    code: "validation_error",
    detail: "Validation failed.",
    fields: {
      file: [{ code: "upload_pixel_limit", params: { max: 25_000_000 } }],
    },
  });
  const failure = annotationUploadFailure(error);
  expect(failure).toEqual({ code: "upload_pixel_limit", params: { max: 25_000_000 } });
  expect(annotationUploadError(failure.code)).toBe("labAnnotation.upload.pixelLimit");
  expect(annotationUploadParams(failure, "es-MX").max).toBe("25,000,000");
});
