import type { Incident, IncidentScope } from "./incidents-query";
import type { useIncidentCommands } from "./use-incident-commands";
import { IncidentSummary } from "./IncidentSummary";
import { IncidentWorkColumns } from "./IncidentWorkColumns";
import { IncidentCommandNotice } from "./IncidentCommandNotice";

interface WorkspaceProps {
  scope: IncidentScope;
  incident: Incident;
  commands: ReturnType<typeof useIncidentCommands>;
  isFetching: boolean;
  review: () => Promise<void>;
}
function isWorkspaceBlocked({ scope, incident, commands, isFetching }: WorkspaceProps) {
  return (
    commands.isBusy ||
    Boolean(commands.failure) ||
    isFetching ||
    !scope.identity.isSettled ||
    incident.action_prerequisites?.is_open !== true
  );
}
export function IncidentWorkspace(props: WorkspaceProps) {
  const { incident, commands, review } = props;
  return (
    <>
      <IncidentSummary incident={incident} />
      <IncidentCommandNotice
        failure={commands.failure}
        onReview={() => {
          void review();
        }}
      />
      <IncidentWorkColumns
        scope={props.scope}
        incident={incident}
        isBlocked={isWorkspaceBlocked(props)}
        isBusy={commands.isBusy}
        submit={commands.submit}
      />
    </>
  );
}
