import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

/** Told in plain words that a missing or abandoned trap also opens a report for the office. */
export function IncidentNotice({ finding }: { readonly finding: string }) {
  const t = useT();
  return ["abandoned", "removed"].includes(finding) ? (
    <InfoNotice tone="info" message={t("field.lifecycle.incidentNotice")} />
  ) : null;
}
