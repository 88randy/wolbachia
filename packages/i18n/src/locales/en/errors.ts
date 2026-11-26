/** English messages of the `errors` area: exactly the keys of `../es-MX/errors.ts`. */
import type { errors as source } from "../es-MX/errors.ts";

export const errors: Record<keyof typeof source, string> = {
  // API errors: the API returns `code` + `params`, never text
  "errors.api.immutableCode":
    "The code cannot be changed. Void the motorcycle and create another with the correct code.",
  "errors.api.motorcycleNotBlocked":
    "This motorcycle is already unblocked. Refresh the list to see its state.",
  "errors.api.motorcycleInUse":
    "This motorcycle has an open shift. Close the shift before voiding it.",
  "errors.api.duplicateCode": "That code is already registered. Use another code and try again.",
  "errors.api.generic": "We couldn't complete the action. Please try again.",
  "errors.api.network": "No connection. Check your signal and try again.",
  "errors.api.validation": "Some data is not valid. Review the highlighted fields and fix them.",
  "errors.api.notFound": "We couldn't find what you're looking for. Go back and try again.",
  "errors.api.permissionDenied":
    "You don't have permission to do this. Ask your supervisor for access.",
  "errors.api.blocked": "This action is blocked for now. Who can unblock it: {role}.",
  "errors.api.sessionRevoked": "Your session ended. Sign in again to continue.",
  "errors.api.rateLimited": "Too many requests in a row. Wait a moment and try again.",
  "errors.api.serverError":
    "Something went wrong on our side. Try again in a few minutes; if it keeps happening, contact support.",
  "errors.api.motorcycleRevisionConflict":
    "The motorcycle changed. Refresh its details and try again.",
  "errors.api.motorcycleFaultNotOpen":
    "The fault is no longer open. Refresh its details to continue.",
  "errors.api.motorcycleInspectionRequired":
    "The motorcycle needs an authorized inspection. Ask your supervisor for help.",
  "errors.upload.contentMismatch":
    "The file content does not match its type. Select the original file.",
  "errors.upload.invalidPdf": "The PDF is invalid or damaged. Select another file.",
  "errors.upload.pdfEncrypted":
    "The PDF is password protected. Remove the protection and upload it again.",
  "errors.upload.typeNotAllowed": "This file type is not accepted here. Use PDF, JPEG or PNG.",
  "errors.upload.tooLarge": "The file is over the {max} limit. Select a smaller one.",
};
