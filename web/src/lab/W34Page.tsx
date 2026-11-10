import { useReceptionScope, receptionScopeKey } from "./use-reception-scope";
import { ReceptionWorkspace } from "./ReceptionWorkspace";
export function W34Page() {
  const scope = useReceptionScope();
  return <ReceptionWorkspace key={receptionScopeKey(scope.identity)} />;
}
