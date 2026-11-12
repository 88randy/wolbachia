/* eslint-disable max-lines-per-function -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import { useDocumentTitle } from "../../shell/use-document-title";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { EmptyValue } from "../../ui/EmptyValue";
import { ErrorState } from "../../ui/ErrorState";
import { InlineNotice } from "../../ui/InlineNotice";
import { StatusPill } from "../../ui/StatusPill";
import { useRegScope } from "../use-reg-list";

/** W61: the retention jobs that exist today. Read-only: there is no policy editor yet. */
export function RetentionPage() {
  const { t } = useTranslation();
  const { client, identity } = useRegScope();
  const formatDateTime = useFormatDateTime();
  useDocumentTitle(t("regulatory.retention.title"));
  const query = useQuery({
    ...orgScopedQueryOptions(identity, {
      key: ["regulatory", "retention"],
      queryFn: async ({ signal }) => unwrap(await client.GET("/api/v1/retention/", { signal })),
    }),
    enabled: identity.isSettled,
  });
  const data = query.data;
  return (
    <PageFrame>
      <PageHeader
        title={t("regulatory.retention.title")}
        description={
          data
            ? t("regulatory.retention.nightly", { time: data.nightly_at, zone: data.timezone })
            : t("regulatory.retention.description")
        }
      />
      {query.isError && (
        <div className="rounded-2xl border border-line bg-surface shadow-card">
          <ErrorState
            message={t("regulatory.retention.error")}
            onRetry={() => {
              void query.refetch();
            }}
          />
        </div>
      )}
      {data === undefined && !query.isError && <CardSkeleton announce={false} />}
      {data && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
            <Table aria-label={t("regulatory.retention.title")}>
              <TableHeader className="bg-surface-muted">
                <TableRow>
                  <TableHead scope="col">{t("regulatory.retention.col.type")}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {t("regulatory.retention.col.period")}
                  </TableHead>
                  <TableHead scope="col">{t("regulatory.retention.col.action")}</TableHead>
                  <TableHead scope="col">{t("regulatory.retention.col.lastRun")}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {t("regulatory.retention.col.processed")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-medium text-ink">
                      {t(`regulatory.retention.type.${row.code as "auth_token_pairs"}`)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t("regulatory.retention.period", { count: row.period_days })}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={row.action === "delete" ? "critical" : "info"}>
                        {t(`regulatory.retention.action.${row.action}`)}
                      </StatusPill>
                    </TableCell>
                    <TableCell>
                      {row.last_run_at ? (
                        formatDateTime(row.last_run_at)
                      ) : (
                        <span className="text-ink-2">{t("regulatory.retention.notRecorded")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.records_processed ?? <EmptyValue />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <InlineNotice tone="info">
            <p>{t("regulatory.retention.note")}</p>
          </InlineNotice>
        </>
      )}
    </PageFrame>
  );
}
