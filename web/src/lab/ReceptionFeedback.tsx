import { useTranslation } from "react-i18next";
import { receptionResultKey } from "./reception-result";
import type { ReceptionResult } from "./reception-command";
import { ReceptionIncidentLink } from "./ReceptionIncidentLink";
import { InlineNotice } from "../ui/InlineNotice";
export function ReceptionFeedback({
  result,
  code,
}: {
  result: ReceptionResult | null;
  code?: string;
}) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {result && (
        <InlineNotice tone={result.code === "received" ? "success" : "warning"}>
          {code && <strong>{code} · </strong>}
          {t(receptionResultKey(result))}
          {result.incidentId && <ReceptionIncidentLink id={result.incidentId} />}
        </InlineNotice>
      )}
    </div>
  );
}
