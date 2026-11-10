import { useQuery } from "@tanstack/react-query";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { eligibilityOptions, personEligibilityRequest } from "./training-query";
import type { TrainingScope } from "./training-query";
import type { PersonContext } from "./person-context";
import { EligibilityResult } from "./EligibilityResult";
import { EligibilityRefreshRequired } from "./EligibilityRefreshRequired";
import { useEligibilityBoundary } from "./use-eligibility-boundary";
interface Props {
  scope: TrainingScope;
  context: PersonContext;
}
export function TrainingEligibility({ scope, context }: Props) {
  const query = useQuery(eligibilityOptions(scope, personEligibilityRequest(context)));
  const requiresRefresh = useEligibilityBoundary({
    nextChange: query.data?.next_change_at,
    isFixedInstant: context.at !== "",
    refetch: query.refetch,
  });
  if (query.isPending) return <CardSkeleton />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  if (requiresRefresh)
    return (
      <EligibilityRefreshRequired
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <EligibilityResult result={query.data} />;
}
