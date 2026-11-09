import { IncidentEvidenceList } from "./IncidentEvidenceList";
import type { Incident, IncidentScope } from "./incidents-query";
import type { useIncidentCommands } from "./use-incident-commands";
import { IncidentSummary } from "./IncidentSummary";
import { IncidentThread } from "./IncidentThread";
import { IncidentActions } from "./IncidentActions";
import { IncidentCommandNotice } from "./IncidentCommandNotice";
import styles from "./incidents.module.css";
interface WorkspaceProps {
 scope: IncidentScope; incident: Incident; commands: ReturnType<typeof useIncidentCommands>;
 isFetching: boolean; review: () => Promise<void>;
}
export function IncidentWorkspace({ scope, incident, commands, isFetching, review }: WorkspaceProps) {
 const isBlocked = commands.isBusy || Boolean(commands.failure) || isFetching ||
 !scope.identity.isSettled || incident.action_prerequisites?.is_open !== true;
 return <>
 <IncidentSummary incident={incident} />
 <IncidentCommandNotice failure={commands.failure} onReview={() => { void review(); }} />
 <div className={styles.workspace}>
 <div className={styles.actions}><IncidentEvidenceList scope={scope} incident={incident} /><IncidentThread events={incident.timeline} /></div>
 <aside className={styles.actions}>
 <IncidentActions scope={scope} incident={incident} isBlocked={isBlocked} isBusy={commands.isBusy} submit={commands.submit} />
 </aside>
 </div>
 </>;
}
