import { useTranslation } from "react-i18next";
import type { Incident } from "./incidents-query";
import { incidentBlockerKey } from "./incident-labels";
import { IncidentLinkedRecord } from "./IncidentLinkedRecord";

export function IncidentBlockerItem({ blocker }: { blocker: Incident["blockers"][number] }) {
  const { t } = useTranslation();
  return (
    <li>
      {t(
        blocker.is_active ? "incidents.workspace.blockActive" : "incidents.workspace.blockCleared",
      )}{" "}
      · {t(incidentBlockerKey(blocker.kind))} · <IncidentLinkedRecord record={blocker.resource} />
    </li>
  );
}
