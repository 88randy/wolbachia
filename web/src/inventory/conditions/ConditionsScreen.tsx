import { CardSkeleton } from "../../ui/CardSkeleton";
import { useDisplaySettled } from "../../session/use-visible-session-state";
import { ErrorState } from "../../ui/ErrorState";
import { NotFoundState } from "../../states/NotFoundState";
import { ConditionsContent } from "./ConditionsContent";
import { useConditionScreen } from "./use-condition-screen";
export function ConditionsScreen({ code }: { code: string }) {
  const model = useConditionScreen(code);
  const { scope, lot } = model;
  const isSettled = useDisplaySettled(scope.identity.isSettled);
  if (!isSettled || lot.isPending) return <CardSkeleton />;
  if (lot.error && !lot.data)
    return (
      <ErrorState
        onRetry={() => {
          void lot.refetch();
        }}
      />
    );
  if (!lot.data) return <NotFoundState />;
  return <ConditionsContent model={model} />;
}
