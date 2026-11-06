import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { NotFoundState } from "../states/NotFoundState";
import { fleetRecordOptions } from "./fleet-query";
import { FleetRecordState } from "./FleetRecordState";
import { MotorcycleScreen } from "./MotorcycleScreen";
interface Props {
  code: string;
  urlCenter?: string | undefined;
}
export function MotorcycleRecord({ code, urlCenter }: Props) {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(fleetRecordOptions({ client, identity, urlCenter }, code));
  const retry = () => {
    void query.refetch();
  };
  if (query.data === null) return <NotFoundState />;
  // The same screen/dialog stays mounted when refreshed state is not yet verified.
  if (query.data !== undefined)
    return (
      <MotorcycleScreen
        motorcycle={query.data}
        error={query.error}
        onRetry={retry}
        isRefreshing={query.isFetching}
      />
    );
  return <FleetRecordState error={query.error} onRetry={retry} />;
}
