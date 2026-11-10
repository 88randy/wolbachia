import type { Schemas } from "@wolbachia/api-client";
import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { Refreshing } from "../../ui/Refreshing";
import { ConditionChartContent } from "./ConditionChartContent";
export function ConditionChart({
  query,
}: {
  query: UseQueryResult<Schemas["PaginatedConditionList"]>;
}) {
  const { t } = useTranslation();
  return (
    <Card title={t("conditions.section.chart")}>
      {query.error && (
        <ErrorState
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      {query.data ? (
        <>
          {query.isFetching && <Refreshing />}
          <ConditionChartContent readings={query.data.results} />
        </>
      ) : (
        !query.error && <CardSkeleton />
      )}
    </Card>
  );
}
