import { useState } from "react";
import type { TypeTarget } from "./incident-types-query";
import { isConfiguredType } from "./incident-types-query";
import { draftOf } from "./type-draft";
import type { TypeDraft } from "./type-draft";
export function useTypeDraft(item?: TypeTarget) {
  const [draft, setDraft] = useState(() => draftOf(item));
  const [isSaved, setSaved] = useState(false);
  const current = isConfiguredType(item) ? item : undefined;
  const [eligibility, setEligibility] = useState({
    supervisor_id: !current?.supervisor,
    coordinator_id: !current?.coordinator,
    terminal_id: false,
  });
  function change<Key extends keyof TypeDraft>(name: Key, value: TypeDraft[Key]) {
    setDraft((previous) => ({ ...previous, [name]: value }));
    setSaved(false);
  }
  function eligible(name: keyof typeof eligibility, value: boolean) {
    setEligibility((previous) =>
      previous[name] === value ? previous : { ...previous, [name]: value },
    );
  }
  function adoptRevision(revision: number) {
    setDraft((previous) => ({ ...previous, expected_revision: revision }));
  }
  function saved(revision: number) {
    adoptRevision(revision);
    setSaved(true);
  }
  return { draft, change, eligible, eligibility, adoptRevision, saved, isSaved };
}
