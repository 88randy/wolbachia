import type { MessageKey } from "@wolbachia/i18n";

/** Failures whose only remedy is to drop the draft: it can never be saved as it is. */
export const DISCARD_REMEDY: readonly MessageKey[] = [
  "mobile.storage.scopeUnavailable",
  "mobile.ovitrap.blockedRetired",
  "mobile.ovitrap.blockedOutdated",
];
