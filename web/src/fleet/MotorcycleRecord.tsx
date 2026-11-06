import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { NotFoundState } from "../states/NotFoundState";
import page from "../styles/page.module.css";
import { fleetRecordOptions } from "./fleet-query";
import { FleetLoadError } from "./FleetLoadError";
import { MotorcycleScreen } from "./MotorcycleScreen";
interface Props {
  code: string;
  urlCenter?: string | undefined;
}
export function MotorcycleRecord({ code, urlCenter }: Props) {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(fleetRecordOptions({ client, identity, urlCenter }, code));
  const retry = () => {
    void query.refetch();
  };
  if (query.data === null) return <NotFoundState />;
  // Keep a conflict dialog and its evidence mounted while refreshing. A failed refresh
  // disables writes and removes the old readiness badge until the state can be verified.
  if (query.data !== undefined)
    return (
      <MotorcycleScreen
        motorcycle={query.data}
        error={query.error}
        onRetry={retry}
        isRefreshing={query.isFetching}
      />
    );
  if (query.error !== null)
    return (
      <section className={page.page}>
        <FleetLoadError error={query.error} onRetry={retry} />
      </section>
    );
  return (
    <p className={page.page} role="status">
      {t("fleet.record.loading")}
    </p>
  );
}
