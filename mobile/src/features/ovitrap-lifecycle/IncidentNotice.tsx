import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
export function IncidentNotice({ finding }: { readonly finding: string }) {
  const t = useT();
  return ["abandoned", "removed"].includes(finding) ? (
    <Notice tone="info" icon="alert" message={t("mobile.lifecycle.incidentNotice")} />
  ) : null;
}
