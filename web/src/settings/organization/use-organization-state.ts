import { useEffect, useState } from "react";
import type { Organization } from "./use-w-03";
import {
  createOrganizationDraft,
  hasOrganizationChanges,
  receiveOrganization,
} from "./organization-draft";
/** Incoming versions synchronize only when no editable field differs from its saved baseline. */
export function useOrganizationState(initial: Organization) {
  const [draft, setDraft] = useState(() => createOrganizationDraft(initial));
  const hasPendingChanges = hasOrganizationChanges(draft.settings, draft.baseline);
  useEffect(() => {
    if (!hasPendingChanges) setDraft((current) => receiveOrganization(current, initial));
  }, [initial, hasPendingChanges]);
  return {
    setDraft,
    settings: draft.settings,
    hasPendingChanges,
    isSaved: draft.notice === "settings",
    isLogoSaved: draft.notice === "logo",
  };
}
