import { useEvidenceSummary } from "../../attachments/use-evidence-summary.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";

/** P28 reuses its existing Try now action; no second retry worker or delete action. */
export function EvidenceNotice() {
  const summary = useEvidenceSummary();
  const t = useT();
  if (summary.hasError)
    return <Notice tone="warning" icon="alert" message={t("mobile.inbox.evidenceError")} />;
  if (!summary.pending) return null;
  return (
    <Notice
      tone="info"
      icon="refresh"
      message={t("mobile.inbox.evidencePending", { count: summary.pending })}
    />
  );
}
