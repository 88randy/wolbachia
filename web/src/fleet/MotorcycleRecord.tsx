import { useQuery } from "@tanstack/react-query";
import { NotFoundState } from "../states/NotFoundState";
import { fleetRecordOptions } from "./fleet-query";
import { FleetRecordState } from "./FleetRecordState";
import { MotorcycleScreen } from "./MotorcycleScreen";
import { useFleetScope } from "./use-fleet-scope";
import { ApiError } from "@wolbachia/api-client";
import { useFleetOperations } from "./use-fleet-operations";
interface Props {
  code: string;
  urlCenter?: string | undefined;
}
export function MotorcycleRecord({ code, urlCenter }: Props) {
  const scope = useFleetScope(code, urlCenter);
  const query = useQuery(fleetRecordOptions(scope, code));
  const data = query.isPlaceholderData ? undefined : query.data;
  const operations = useFleetOperations(scope, { ...query, data });
  const retry = () => {
    void query.refetch();
  };
  if (!scope.identity.isSettled) return <FleetRecordState error={null} onRetry={retry} />;
  if (data === null || (query.error instanceof ApiError && [403, 404].includes(query.error.status)))
    return <NotFoundState />;
  // The same screen/dialog stays mounted when refreshed state is not yet verified.
  if (data !== undefined)
    return (
      <MotorcycleScreen
        motorcycle={data}
        scope={scope}
        operations={operations}
        error={query.error}
        onRetry={retry}
        isRefreshing={query.isFetching}
      />
    );
  return <FleetRecordState error={query.error} onRetry={retry} />;
}
