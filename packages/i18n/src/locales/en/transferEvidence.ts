import type { transferEvidence as SpanishCatalog } from "../es-MX/transferEvidence.ts";
export const transferEvidence: Record<keyof typeof SpanishCatalog, string> = {
  "transferEvidence.upload.hint":
    "Select a PNG or JPEG image up to 10 MiB and verify the upload before continuing.",
  "transferEvidence.upload.verify": "Verify image",
  "transferEvidence.upload.pending": "Image awaiting verification",
  "transferEvidence.upload.verified": "Image verified",
  "transferEvidence.upload.invalid": "Select a PNG or JPEG image up to 10 MiB.",
  "transferEvidence.upload.failed":
    "We could not confirm the image. Retry verification; your file is preserved.",
  "transferEvidence.upload.noPermission":
    "Your profile cannot upload images. Ask an administrator for upload permission to complete the signature or evidence.",
};
