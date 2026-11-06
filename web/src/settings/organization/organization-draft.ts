import type { Organization } from "./use-w-03";
export interface OrganizationDraft {
  settings: Organization;
  baseline: Organization;
  notice: "settings" | "logo" | null;
}
const EDITABLE_FIELDS = [
  "name",
  "timezone",
  "epi_week",
  "languages",
  "label_phone",
  "support_contact",
] as const;
export function hasOrganizationChanges(draft: Organization, baseline: Organization): boolean {
  return EDITABLE_FIELDS.some(
    (key) => JSON.stringify(draft[key]) !== JSON.stringify(baseline[key]),
  );
}
export function createOrganizationDraft(initial: Organization): OrganizationDraft {
  return { settings: initial, baseline: initial, notice: null };
}
/** Background versions may replace clean forms; dirty forms retain their expected revision. */
export function receiveOrganization(
  draft: OrganizationDraft,
  initial: Organization,
): OrganizationDraft {
  if (
    initial.revision <= draft.baseline.revision ||
    hasOrganizationChanges(draft.settings, draft.baseline)
  )
    return draft;
  return createOrganizationDraft(initial);
}
/** Logo-only writes and explicit conflict review preserve all editable fields. */
export function rebaseOrganizationDraft(
  draft: OrganizationDraft,
  result: Organization,
): OrganizationDraft {
  if (result.revision < draft.baseline.revision) return draft;
  return {
    settings: { ...draft.settings, revision: result.revision, logo_url: result.logo_url },
    baseline: result,
    notice: null,
  };
}

/** Neither acknowledgements nor explicit review may lower the saved baseline revision. */
export function acceptOrganizationDraft(
  draft: OrganizationDraft,
  result: Organization,
  notice: NonNullable<OrganizationDraft["notice"]>,
): OrganizationDraft {
  if (result.revision < draft.baseline.revision) return draft;
  const accepted =
    notice === "settings"
      ? createOrganizationDraft(result)
      : rebaseOrganizationDraft(draft, result);
  return { ...accepted, notice };
}
