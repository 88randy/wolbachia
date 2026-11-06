import { useState } from "react";
import type { Organization } from "./use-w-03";
import { acceptOrganizationDraft, rebaseOrganizationDraft } from "./organization-draft";
import { useOrganizationState } from "./use-organization-state";
export function useOrganizationDraft(initial: Organization) {
  const { setDraft, ...state } = useOrganizationState(initial);
  const [comparison, setComparison] = useState<Organization | null>(null);
  function change<K extends keyof Organization>(key: K, value: Organization[K]) {
    setDraft((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
      notice: null,
    }));
  }
  function accept(result: Organization) {
    setDraft((current) => acceptOrganizationDraft(current, result, "settings"));
  }
  function acceptLogo(result: Organization) {
    setDraft((current) => acceptOrganizationDraft(current, result, "logo"));
  }
  function review(onReviewed: () => void) {
    if (!comparison) return;
    setDraft((current) => rebaseOrganizationDraft(current, comparison));
    setComparison(null);
    onReviewed();
  }
  return { ...state, change, comparison, setComparison, accept, acceptLogo, review };
}
