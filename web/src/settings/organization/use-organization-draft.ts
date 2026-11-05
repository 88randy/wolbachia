import { useState } from "react";
import type { Organization } from "./use-w-03";
export function useOrganizationDraft(initial: Organization) {
  const [settings, setSettings] = useState(initial);
  const [comparison, setComparison] = useState<Organization | null>(null);
  const [isSaved, setSaved] = useState(false);
  function change<K extends keyof Organization>(key: K, value: Organization[K]) {
    setSaved(false);
    setSettings((previous) => ({ ...previous, [key]: value }));
  }
  function accept(result: Organization) {
    setSettings(result);
    setSaved(true);
  }
  function acceptLogo(result: Organization) {
    setSettings((draft) => ({ ...draft, revision: result.revision, logo_url: result.logo_url }));
    setSaved(true);
  }
  function review(onReviewed: () => void) {
    if (comparison) {
      change("revision", comparison.revision);
      setComparison(null);
      onReviewed();
    }
  }
  return { settings, change, isSaved, comparison, setComparison, accept, acceptLogo, review };
}
