import { useQuery } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../api/ApiClientProvider";
import { ListPage } from "../components/templates/ListPage";
import { useCan } from "../session/use-can";
import { useSessionIdentity } from "../session/use-session-identity";
import { CardSkeleton } from "../ui/CardSkeleton";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { InlineNotice } from "../ui/InlineNotice";
import { QuadrantCard } from "./QuadrantCard";
import { assignmentsOptions } from "./scheduling-queries";
import { useCouriers } from "./use-directories";
import { useMoveQuadrant } from "./use-scheduling-writes";

const NONE = "none";

/** W25: couriers as columns, quadrants as cards. "Move to" works with the keyboard. */
export function W25Page() {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const can = useCan();
  const query = useQuery(assignmentsOptions(client, identity));
  const move = useMoveQuadrant();
  const rows = query.data?.results ?? [];
  const assigned = rows.flatMap((row) => (row.courier === null ? [] : [row.courier]));
  const { nameOf, ids } = useCouriers(assigned);
  const canMove = can("schedule.manage");
  const columns = [...ids, NONE];
  const options = [
    ...ids.map((id) => ({ value: id, label: nameOf(id) })),
    { value: NONE, label: t("scheduling.assign.unassign") },
  ];
  return (
    <ListPage
      title={t("scheduling.assign.title")}
      description={t("scheduling.assign.description")}
      notices={
        !canMove && (
          <InlineNotice tone="info">
            <p className="flex items-center gap-2">
              <Info aria-hidden="true" className="size-4" />
              {t("scheduling.assign.readOnly")}
            </p>
          </InlineNotice>
        )
      }
    >
      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState kind="noData" message={t("scheduling.assign.empty")} />
      ) : (
        <div className="grid min-w-0 gap-5 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
          {columns.map((id) => {
            const mine = rows.filter((row) => (row.courier ?? NONE) === id);
            if (id === NONE && mine.length === 0) return null;
            const load = mine.reduce((sum, row) => sum + row.load, 0);
            return (
              <section
                key={id}
                aria-labelledby={`col-${id}`}
                className="flex min-w-0 flex-col gap-3 rounded-2xl bg-surface-muted p-3"
              >
                <header className="flex items-baseline justify-between gap-2 px-1">
                  <h2 id={`col-${id}`} className="m-0 text-[15px] font-semibold text-ink">
                    {nameOf(id === NONE ? null : id)}
                  </h2>
                  <span className="text-xs text-ink-2 tabular-nums">
                    {t("scheduling.assign.columnSummary", { count: mine.length, load })}
                  </span>
                </header>
                <ul className="m-0 flex list-none flex-col gap-3 p-0">
                  {mine.map((row) => (
                    <QuadrantCard
                      key={row.quadrant}
                      row={row}
                      canMove={canMove}
                      isBusy={move.isPending}
                      options={options.filter((option) => option.value !== (row.courier ?? NONE))}
                      onMove={(courierId) => {
                        move.mutate({
                          expected_revision: row.revision,
                          quadrant_id: row.quadrant,
                          courier_id: courierId,
                        });
                      }}
                    />
                  ))}
                  {mine.length === 0 && (
                    <li className="rounded-xl border border-dashed border-line-strong p-4 text-center text-[13px] text-ink-2">
                      {t("scheduling.assign.columnEmpty")}
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </ListPage>
  );
}
