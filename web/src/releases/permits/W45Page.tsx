import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@wolbachia/api-client";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
import { PendingState } from "../../states/PendingState";
import { NotFoundState } from "../../states/NotFoundState";
import { ErrorState } from "../../ui/ErrorState";
import { PermitRecord } from "./PermitRecord";
import { permitRecordOptions } from "./permits-query";

const DENIED = [403, 404];

/**
 * W45, one permit by its human code. An unknown code, a foreign one and one outside the user's
 * scope all end in the same not-found state, so nothing reveals which exist.
 */
export function W45Page() {
  const { code } = useParams({ strict: false });
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(permitRecordOptions(client, identity, code ?? ""));
  if (!code) return <NotFoundState />;
  if (query.data === null) return <NotFoundState />;
  if (query.error instanceof ApiError && DENIED.includes(query.error.status))
    return <NotFoundState />;
  if (query.data !== undefined) return <PermitRecord key={query.data.id} permit={query.data} />;
  if (query.error !== null)
    return (
      <ErrorState
        message={t("permits.detail.loadFailed")}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <PendingState />;
}
