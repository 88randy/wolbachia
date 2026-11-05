/** English messages of the `states` area: exactly the keys of `../es-MX/states.ts`. */
import type { states as source } from "../es-MX/states.ts";

export const states: Record<keyof typeof source, string> = {
  // Web global states
  "states.placeholder.body": "This section is still under construction.",
  "states.loading.label": "Loading content",
  "states.notFound.title": "We couldn't find this page",
  "states.notFound.body":
    "The address doesn't exist or is no longer available. Go back to the home page and try again.",
  "states.error.title": "Something went wrong on this screen",
  "states.error.body":
    "You can try again or go back to the home page. If it keeps happening, tell support.",
  "states.noPermission.title": "You don't have access to this section",
  "states.noPermission.area": "Section",
  "states.noPermission.body":
    "Your current profile doesn't allow opening it. Ask your organization's administrator for access.",
  "states.config.title": "The app is not ready",
  "states.config.missingApiUrl":
    "The server address is not configured or is not valid. Tell technical support so they can fix it.",
  "states.sessionCheck.title": "We could not check your session",
  "states.sessionCheck.body":
    "Another tab changed the session and we could not confirm who you are. No organization data is shown until we know. Check your connection and try again.",
  "states.offline.banner":
    "No connection. What you see may be out of date; it will refresh when the network is back.",
};
