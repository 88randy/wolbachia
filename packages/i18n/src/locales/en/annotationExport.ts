import type { annotationExport as esAnnotationExport } from "../es-MX/annotationExport.ts";

export const annotationExport: Record<keyof typeof esAnnotationExport, string> = {
  "annotationExport.permission.label": "Export annotation training data",
  "annotationExport.page.title": "Export training data",
  "annotationExport.page.description":
    "Prepare verified images and manual annotations for AedesVision.",
  "annotationExport.page.card":
    "Generate COCO or YOLO archives with images, boxes and separate points.",
  "annotationExport.form.title": "New export",
  "annotationExport.form.hint":
    "Both dates are included in the organization's time zone. Points are stored separately and are never converted into boxes.",
  "annotationExport.form.photoNotice":
    "Metadata, file names and the manifest contain no personal data. Photos may show handwritten codes or labels; review them before sharing the dataset.",
  "annotationExport.form.disclosureNotice":
    "Generating the export reveals the included counts: you will no longer be able to perform blind recounts of those bags.",
  "annotationExport.form.from": "Start date",
  "annotationExport.form.to": "End date",
  "annotationExport.form.author": "Author (optional)",
  "annotationExport.form.authorUnavailable":
    "All authors will be included. Ask an administrator for access to the people directory to choose one.",
  "annotationExport.form.includeVoided": "Include voided annotations",
  "annotationExport.form.format": "Format",
  "annotationExport.form.submit": "Generate export",
  "annotationExport.form.queued": "Export requested. Check its status in the table.",
  "annotationExport.format.coco": "COCO",
  "annotationExport.format.yolo": "YOLO",
  "annotationExport.list.title": "Exports",
  "annotationExport.list.hint":
    "Newest exports appear first. Generate an export above and download it when ready.",
  "annotationExport.list.filters": "Filters",
  "annotationExport.list.export": "Export",
  "annotationExport.list.content": "Contents",
  "annotationExport.list.period": "Period",
  "annotationExport.list.imageCount": "Images",
  "annotationExport.list.boxCount": "Boxes",
  "annotationExport.list.pointCount": "Points",
  "annotationExport.list.status": "Status",
  "annotationExport.list.download": "Download",
  "annotationExport.list.regenerate": "Generate again",
  "annotationExport.list.notReady": "Available when ready.",
  "annotationExport.status.queued": "Queued",
  "annotationExport.status.running": "Preparing",
  "annotationExport.status.ready": "Ready",
  "annotationExport.status.failed": "Failed",
  "annotationExport.status.expired": "Expired",
  "annotationExport.error.required": "Select both the start date and end date.",
  "annotationExport.error.invalid": "Select valid dates.",
  "annotationExport.error.range": "The end date must be on or after the start date.",
  "annotationExport.error.tooLong": "Select up to {maxDays} days, including both dates.",
  "annotationExport.error.tooMany":
    "The dataset exceeds {maxImages} images. Shorten the period or choose an author and generate again.",
  "annotationExport.error.tooLarge":
    "The dataset exceeds {maxBytes} bytes. Shorten the period or choose an author and generate again.",
  "annotationExport.error.inProgress":
    "Exports are being prepared. Wait for them to finish and generate again.",
  "annotationExport.error.failed":
    "The request was not confirmed. Check the table before generating again to avoid duplicates.",
  "annotationExport.error.task":
    "Preparation failed. Generate another export or ask an administrator for help.",
  "annotationExport.error.download": "The download failed. Try again.",
};
