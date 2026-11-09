import { IncidentEvidenceList } from "./IncidentEvidenceList";
import { IncidentThread } from "./IncidentThread";
import { IncidentActions } from "./IncidentActions";
import type { IncidentActionProps } from "./IncidentComment";
import type { IncidentScope } from "./incidents-query";
import styles from "./incidents.module.css";

export function IncidentWorkColumns(props: IncidentActionProps & { scope: IncidentScope }) {
  return (
    <div className={styles.workspace}>
      <div className={styles.actions}>
        <IncidentEvidenceList scope={props.scope} incident={props.incident} />
        <IncidentThread events={props.incident.timeline} />
      </div>
      <aside className={styles.actions}>
        <IncidentActions {...props} />
      </aside>
    </div>
  );
}
