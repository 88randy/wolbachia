import type { UseQueryResult } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { ConditionSummary } from "./ConditionSummary";
import { ConditionHistory } from "./ConditionHistory";
import { ConditionCapture } from "./ConditionCapture";
import type { useConditionCapture } from "./use-condition-capture";
import { isConditionAccessDenied } from "./condition-access";
interface Props {
  status: UseQueryResult<Schemas["ConditionStatus"]>;
  lot: string;
  capture: ReturnType<typeof useConditionCapture>;
  isLotReady: boolean;
}
export function ConditionStatusContent({ status, lot, capture, isLotReady }: Props) {
  if (status.isPending) return <CardSkeleton />;
  if (isConditionAccessDenied(status.error) || !status.data)
    return (
      <ErrorState
        onRetry={() => {
          void status.refetch();
        }}
      />
    );
  const ready = isLotReady && !status.error && !status.isFetching && !status.isPlaceholderData;
  return (
    <>
      {status.error && (
        <ErrorState
          onRetry={() => {
            void status.refetch();
          }}
        />
      )}
      <ConditionSummary status={status.data} />
      <ConditionCapture capture={capture} status={status.data} ready={ready} />
      <ConditionHistory lot={lot} />
    </>
  );
}
