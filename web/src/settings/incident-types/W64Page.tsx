import { useSessionIdentity } from "../../session/use-session-identity";
import { typeEditorKey } from "./incident-types-query";
import { IncidentTypesScreen } from "./IncidentTypesScreen";
/** W64 configuration drafts belong to one actor, organization and current authorization context. */
export function W64Page() {
  const identity = useSessionIdentity();
  return <IncidentTypesScreen key={typeEditorKey(identity)} />;
}
