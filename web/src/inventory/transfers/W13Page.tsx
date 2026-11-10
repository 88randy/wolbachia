import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { NotFoundState } from "../../states/NotFoundState";
import { transferRecordOptions } from "./transfer-query";
import type { TransferScope } from "./transfer-query";
import type { TransferMemory } from "./use-transfer-write";
import { TransferRecord } from "./TransferRecord";
import { useTransferRetirement } from "./use-transfer-retirement";
import { transferRouteScope } from "./transfer-route-scope";
export function W13Page({ scope: current, code }: { scope: TransferScope; code: string }) {
  const scope = transferRouteScope(current, "transfers", code);
  const { t } = useTranslation();
  const query = useQuery(transferRecordOptions(scope, code));
  const memory = useMemo<TransferMemory>(() => ({}), []);
  const retirement = useTransferRetirement({ scope, memory, query, code });
  if (query.isPending || query.isPlaceholderData) return <CardSkeleton />;
  if (query.error instanceof ApiError && [403, 404].includes(query.error.status))
    return <NotFoundState />;
  if (query.isError)
    return (
      <ErrorState
        message={t("transfers.page.readError")}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  if (!query.data || query.data.code !== code) return <NotFoundState />;
  return (
    <TransferRecord
      key={`${query.data.id}:${String(retirement)}`}
      scope={scope}
      transfer={query.data}
      memory={memory}
    />
  );
}
