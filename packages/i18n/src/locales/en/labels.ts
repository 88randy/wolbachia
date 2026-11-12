/** English messages of the shared label printing: exactly the keys of `../es-MX/labels.ts`. */
import type { labels as source } from "../es-MX/labels.ts";

export const labels: Record<keyof typeof source, string> = {
  "labels.action.print": "Print labels",
  "labels.action.printOne": "Print label",
  "labels.action.printPage": "Print labels of this page",
  "labels.action.printSelected": "Print labels of the selected rows",
  "labels.dialog.title": "Print labels",
  "labels.dialog.description":
    "Each label has a QR code and the record code, so it can be scanned later to fill in the form.",
  "labels.dialog.count": "Different labels: {count}",
  "labels.dialog.total": "Labels in total: {count}",
  "labels.dialog.tooMany": "That is too many labels. The first {count} are printed.",
  "labels.format.field": "Label size",
  "labels.format.hint":
    "If you are not sure: 50 × 25 mm for a roll printer, or the letter sheet if you use adhesive label sheets.",
  "labels.format.thermal50x25": "Roll 50 × 25 mm",
  "labels.format.thermal62x29": "Roll 62 × 29 mm",
  "labels.format.letter3x10": "Letter sheet, 30 labels (66.7 × 25.4 mm)",
  "labels.copies.field": "Copies of each label",
  "labels.copies.hint": "From 1 to {max}.",
  "labels.preview.title": "Preview",
  "labels.preview.hint": "Shown at real size, as it will come out on paper.",
  "labels.qr.alt": "QR code of {code}",
  "labels.print.button": "Print",
  "labels.print.noRecords": "There are no records to print.",
  "labels.print.help":
    "Your computer's print window opens. Pick your printer and, if asked, set margins to “None” and scale to 100%.",
  "labels.line.expires": "Expires {date}",
  "labels.line.createdOn": "Registered {date}",
  "labels.line.plate": "Plate {plate}",
  "labels.line.point": "Point {code}",
};
