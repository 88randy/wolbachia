import { CardSkeleton } from "../ui/CardSkeleton";
import { NotFoundState } from "../states/NotFoundState";
import { IncidentReadError } from "./IncidentReadError";
import { IncidentRecordContent } from "./IncidentRecordContent";
import { useIncidentRecord } from "./use-incident-record";

export function IncidentRecord({ code }: { code: string }) {
  const record = useIncidentRecord(code);
  const { query, retry } = record;
  if (query.isPending) return <CardSkeleton />;
  if (query.isError && !query.data)
    return <IncidentReadError error={query.error} onRetry={retry} />;
  if (!query.data) return <NotFoundState />;
  return <IncidentRecordContent code={code} incident={query.data} record={record} />;
}
