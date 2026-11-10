import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { DetailPage } from "../../components/templates/DetailPage";
import { useSessionIdentity } from "../../session/use-session-identity";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { ReleaseDetail } from "./ReleaseDetail";
import { releaseOptions } from "./releases-query";

/** W46 detail: one release with its origin, why it is in review (if so) and its map point. */
export function W46DetailPage() {
  const { t } = useTranslation();
  const { id } = useParams({ strict: false });
  const query = useQuery(releaseOptions(useApiClient(), useSessionIdentity(), id ?? ""));
  if (query.data !== undefined) return <ReleaseDetail release={query.data} />;
  return (
    <DetailPage title={t("releases.records.title")}>
      {query.error === null ? (
        <CardSkeleton />
      ) : (
        <ErrorState
          message={t("releases.detail.notFound")}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
    </DetailPage>
  );
}
