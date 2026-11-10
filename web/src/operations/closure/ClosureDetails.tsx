import { ErrorState } from "../../ui/ErrorState";
import { Refreshing } from "../../ui/Refreshing";
import { ClosureBlockers } from "./ClosureBlockers";
import { ClosureAction } from "./ClosureAction";
import { ClosureOutcome } from "./ClosureOutcome";
import type { ClosureModel } from "./use-closure-model";
import type { Readiness } from "./closure-policy";
export function ClosureDetails({
  model,
  readiness,
}: {
  model: ClosureModel;
  readiness: Readiness;
}) {
  const { query, isRecordFetching, quadrant, write, refresh } = model;
  return (
    <>
      {(query.isFetching || isRecordFetching) && <Refreshing />}
      {query.error && <ErrorState onRetry={refresh} />}
      <ClosureBlockers readiness={readiness} />
      <ClosureOutcome result={write.result} receipt={readiness.closure} />
      <ClosureAction
        quadrant={quadrant}
        readiness={readiness}
        write={write}
        isCurrent={!query.isFetching && !isRecordFetching && !query.error}
      />
    </>
  );
}
