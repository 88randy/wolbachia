import { ApiError } from "@wolbachia/api-client";
import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { NotFoundState } from "../states/NotFoundState";
import { CardSkeleton } from "../ui/CardSkeleton";
import page from "../styles/page.module.css";
import { parameterQueryOptions } from "./rules-query";
import { ParameterScreen } from "./ParameterScreen";
import { ParameterRefreshState } from "./ParameterRefreshState";
import { ParameterLoadFailed } from "./ParameterLoadFailed";
import { useRetainedParameter } from "./use-retained-parameter";
const HTTP_NOT_FOUND = 404;
/** A refresh failure keeps the mounted form and its draft; only the first load is replaced. */
export function ParameterLoader({ parameterKey }: { parameterKey: string }) {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(parameterQueryOptions(client, identity, parameterKey));
  const { error } = query;
  const view = useRetainedParameter(identity, parameterKey, query);
  const retry = () => void query.refetch();
  if (view.parameter !== undefined) {
    const notice = (
      <ParameterRefreshState error={error} onRetry={retry} isFetching={query.isFetching} />
    );
    return <ParameterScreen key={view.scope} parameter={view.parameter} notice={notice} />;
  }
  if (error instanceof ApiError && error.status === HTTP_NOT_FOUND) return <NotFoundState />;
  if (error !== null) return <ParameterLoadFailed error={error} onRetry={retry} />;
  return (
    <section className={page.page}>
      <CardSkeleton />
    </section>
  );
}
