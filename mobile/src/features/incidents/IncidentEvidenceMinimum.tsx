import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { IncidentDraft } from "./types.ts";

export function IncidentEvidenceMinimum({ draft }: { readonly draft: IncidentDraft }) {
  const t = useT();
  if (!draft.type) return null;
  const minimum = draft.type.report_evidence_min;
  if (draft.evidence.length >= minimum) return null;
  return (
    <InfoNotice
      tone="warning"
      message={`${t("mobile.incidents.evidenceMissing")} (${String(draft.evidence.length)}/${String(minimum)})`}
    />
  );
}
