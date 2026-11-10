import type { permitDocument as SpanishCatalog } from "../es-MX/permitDocument.ts";
export const permitDocument: Record<keyof typeof SpanishCatalog, string> = {
  "permitDocument.file.label": "Permit official document",
  "permitDocument.file.hint":
    "Select a PDF, JPEG or PNG up to {max}. The name and size show before uploading.",
  "permitDocument.file.selected": "Selected file: {name} ({size})",
  "permitDocument.file.upload": "Upload document",
  "permitDocument.file.retry": "Retry upload",
  "permitDocument.file.invalidType": "Only PDF, JPEG or PNG files are accepted.",
  "permitDocument.file.tooLarge": "The file is over the {max} limit.",
  "permitDocument.file.empty": "The file is empty.",
  "permitDocument.download.action": "Download official document",
  "permitDocument.download.failed": "We could not download the document. Try again.",
};
