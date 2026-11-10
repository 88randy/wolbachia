import { useCan } from "../session/use-can";
import { ReadableReceptionIncident } from "./ReadableReceptionIncident";
export function ReceptionIncidentLink({ id }: { id: string }) {
  const can = useCan();
  return can("incident.read") ? <ReadableReceptionIncident id={id} /> : null;
}
