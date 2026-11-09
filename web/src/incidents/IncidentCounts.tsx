import { useTranslation } from "react-i18next";
import { IncidentCountLink } from "./IncidentCountLink";
import type { IncidentScope } from "./incidents-query";
import styles from "./incidents.module.css";
export function IncidentCounts({ scope }: { scope: IncidentScope }) {
  const { t } = useTranslation();
  const center = scope.identity.activeCenter || undefined;
  return (
    <nav aria-label={t("incidents.workspace.views")} className={styles.counts}>
      <IncidentCountLink
        scope={scope}
        label="incidents.workspace.mine"
        filters={{ center, state: "open", assigned_to_me: "true" }}
      />
      <IncidentCountLink
        scope={scope}
        label="incidents.workspace.zone"
        filters={{ center, state: "open" }}
      />
      <IncidentCountLink
        scope={scope}
        label="incidents.workspace.overdue"
        filters={{ center, state: "open", overdue: "true" }}
      />
      <IncidentCountLink
        scope={scope}
        label="incidents.workspace.closed"
        filters={{ center, state: "closed" }}
      />
    </nav>
  );
}
