import { useParams } from "@tanstack/react-router";
import { useGeographyScope } from "./use-w-15";
import { QuadrantRecord } from "./QuadrantRecord";
import { DraftMemoryProvider } from "./DraftMemoryProvider";
import { NotFoundState } from "../../states/NotFoundState";
export function W23Page() {
  const { code } = useParams({ strict: false });
  const scope = useGeographyScope();
  if (!code || !scope.canRead) return <NotFoundState />;
  const draftIdentity =
    scope.me.user.id +
    "|" +
    (scope.me.organization?.slug ?? "") +
    "|" +
    code +
    "|" +
    (scope.urlCenter ?? scope.identity.activeCenter ?? "");
  return (
    <DraftMemoryProvider key={draftIdentity} scope={scope}>
      <QuadrantRecord key={scope.context + "|" + code} scope={scope} code={code} />
    </DraftMemoryProvider>
  );
}
