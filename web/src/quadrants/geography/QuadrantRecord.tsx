import { NotFoundState } from "../../states/NotFoundState";
import { PendingState } from "../../states/PendingState";
import { useDocumentTitle } from "../../shell/use-document-title";
import type { GeographyScope } from "./use-w-15";
import { GeographyLoadError } from "./GeographyLoadError";
import { QuadrantScreen } from "./QuadrantScreen";
import { useQuadrantRecord } from "./use-quadrant-record";
interface Props {
  scope: GeographyScope;
  code: string;
}
export function QuadrantRecord({ scope, code }: Props) {
  useDocumentTitle(code);
  const { query, record, isDenied, refresh, retry } = useQuadrantRecord(scope, code);
  if (isDenied) return <NotFoundState />;
  if (!record && query.error) return <GeographyLoadError error={query.error} retry={retry} />;
  if (!record && query.isPending) return <PendingState />;
  if (!record) return <NotFoundState />;
  return (
    <>
      {query.error && <GeographyLoadError error={query.error} retry={retry} />}
      <QuadrantScreen scope={scope} quadrant={record} refresh={refresh} />
    </>
  );
}
