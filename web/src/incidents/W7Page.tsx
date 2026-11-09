import { useParams } from "@tanstack/react-router";
import { NotFoundState } from "../states/NotFoundState";
import { useIncidentScope, incidentScopeKey } from "./use-incident-scope";
import { IncidentRecord } from "./IncidentRecord";
export function W7Page() {
 const { code } = useParams({ strict: false });
 const scope = useIncidentScope();
 return code ? <IncidentRecord key={`${incidentScopeKey(scope.identity)}:${code}`} code={code} /> : <NotFoundState />;
}
