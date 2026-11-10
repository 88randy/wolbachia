import { useEvidenceSummary } from "../../attachments/use-evidence-summary.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

/** P28 reuses its existing Try now action; no second retry worker or delete action. */
export function EvidenceNotice() {
  const summary = useEvidenceSummary();
  const t = useT();
  if (summary.hasError)
    return <InfoNotice tone="warning" message={t("mobile.inbox.evidenceError")} />;
  if (!summary.pending) return null;
  return (
    <InfoNotice
      tone="info"
      message={t("mobile.inbox.evidencePending", { count: summary.pending })}
    />
  );
}
