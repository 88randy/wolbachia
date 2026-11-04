/** English messages of the `errors` area: exactly the keys of `../es-MX/errors.ts`. */
import type { errors as source } from "../es-MX/errors.ts";

export const errors: Record<keyof typeof source, string> = {
  // API errors: the API returns `code` + `params`, never text
  "errors.api.generic": "We couldn't complete the action. Please try again.",
  "errors.api.network": "We can't reach the server. Check your signal and try again.",
  "errors.api.validation": "Some data is not valid. Review the highlighted fields and fix them.",
  "errors.api.notFound": "We couldn't find what you're looking for. Go back and try again.",
  "errors.api.permissionDenied":
    "You don't have permission to do this. Ask your supervisor for access.",
  "errors.api.blocked": "This action is blocked for now. Who can unblock it: {role}.",
  "errors.api.sessionRevoked": "Your session ended. Sign in again to continue.",
  "errors.api.rateLimited": "Too many requests in a row. Wait a moment and try again.",
  "errors.api.serverError":
    "Something went wrong on our side. Try again in a few minutes; if it keeps happening, contact support.",
};
