/* eslint-disable max-lines-per-function, complexity -- page composition: one query and its states. */
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { ApiError } from "@wolbachia/api-client";
import { ArrowLeft, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { useSessionIdentity } from "../session/use-session-identity";
import { useDocumentTitle } from "../shell/use-document-title";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { StateFrame } from "../ui/StateFrame";
import { StatusPill } from "../ui/StatusPill";
import { historyOptions, isRecordType } from "./discovery-query";
import { HistoryEntryItem } from "./HistoryEntryItem";
import { ownScreen } from "./record-links";

/** W4 Universal record history: the timeline of any record, newest first. */
export function RecordHistoryPage() {
  const { t } = useTranslation();
  const { recordType, code } = useParams({ strict: false });
  const type = isRecordType(recordType) ? recordType : undefined;
  const client = useApiClient();
  const identity = useSessionIdentity();
  const title = t("discovery.history.title", { code: code ?? "" });
  useDocumentTitle(title);
  const query = useInfiniteQuery({
    ...historyOptions(client, identity, { type: type ?? "", code: code ?? "" }),
    enabled: identity.isSettled && type !== undefined && code !== undefined,
  });
  const entries = query.data?.pages.flatMap((page) => page.results) ?? [];
  const record = query.data?.pages[0]?.record;
  const isMissing =
    type === undefined || (query.error instanceof ApiError && query.error.status === 404);
  const own = type !== undefined && code !== undefined ? ownScreen(type, code) : null;
  return (
    <PageFrame width="narrow">
      <PageHeader
        eyebrow={type === undefined ? undefined : t(`discovery.typeOne.${type}`)}
        title={code ?? ""}
        status={
          record?.is_voided ? (
            <StatusPill tone="neutral">{t("discovery.search.voided")}</StatusPill>
          ) : undefined
        }
        actions={
          own ? (
            <Link
              {...own}
              className="inline-flex min-h-9 items-center rounded-lg bg-action px-4 text-sm font-semibold text-on-action no-underline hover:bg-action-strong"
            >
              {t("discovery.history.openRecord")}
            </Link>
          ) : undefined
        }
      />
      <Link
        to="/search"
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-action hover:underline"
      >
        <ArrowLeft aria-hidden="true" strokeWidth={1.75} className="size-4" />
        {t("discovery.history.backToSearch")}
      </Link>
      {isMissing && <StateFrame icon={History} message={t("discovery.history.notFound")} />}
      {!isMissing && query.isError && (
        <ErrorState
          message={t("discovery.history.loadError")}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      {!isMissing && query.data === undefined && !query.isError && <CardSkeleton />}
      {!isMissing && query.data && (
        <Card title={t("discovery.history.timeline")} headingLevel={2}>
          {entries.length === 0 ? (
            <StateFrame icon={History} message={t("discovery.history.empty")} />
          ) : (
            <ol className="m-0 flex list-none flex-col p-0">
              {entries.map((entry) => (
                <HistoryEntryItem key={`${entry.source_type}-${entry.source_id}`} entry={entry} />
              ))}
            </ol>
          )}
          {query.hasNextPage && (
            <div className="mt-4">
              <Button
                variant="secondary"
                loading={query.isFetchingNextPage}
                onClick={() => {
                  void query.fetchNextPage();
                }}
              >
                {t("discovery.history.loadMore")}
              </Button>
            </div>
          )}
        </Card>
      )}
    </PageFrame>
  );
}
