import { Link } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ListPage } from "../components/templates/ListPage";
import { buttonVariants } from "../ui/button-variants";
import { CardSkeleton } from "../ui/CardSkeleton";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { InfoHint } from "../ui/InfoHint";
import { InlineNotice } from "../ui/InlineNotice";
import { CourierColumn } from "./CourierColumn";
import { useAssignmentBoard } from "./use-assignment-board";

/** W25: couriers as columns, quadrants as cards. Drag, or "Mover a…" with the keyboard; saves at once. */
export function W25Page() {
  const { t } = useTranslation();
  const board = useAssignmentBoard();
  const columns = board.columns.filter(
    (column) => column.courier !== null || column.rows.length > 0,
  );
  return (
    <ListPage
      title={t("scheduling.assign.title")}
      description={
        <>
          {t("scheduling.assign.description")}
          <InfoHint text={t("scheduling.assign.hint")} />
        </>
      }
      actions={
        <Link to="/scheduling/plan" className={buttonVariants({ variant: "secondary" })}>
          <CalendarDays aria-hidden="true" />
          {t("scheduling.assign.goPlan")}
        </Link>
      }
      notices={
        !board.canMove && (
          <InlineNotice tone="info">
            <p>{t("scheduling.assign.readOnly")}</p>
          </InlineNotice>
        )
      }
    >
      {board.isError ? (
        <ErrorState onRetry={board.refetch} />
      ) : board.isPending ? (
        <CardSkeleton />
      ) : board.rows.length === 0 ? (
        <EmptyState
          kind="noData"
          message={`${t("scheduling.assign.empty")} ${t("scheduling.assign.emptyHelp")}`}
          action={
            <Link to="/quadrants" className={buttonVariants({ variant: "secondary" })}>
              {t("scheduling.assign.emptyAction")}
            </Link>
          }
        />
      ) : (
        <>
          <p className="m-0 text-[13px] text-ink-2">
            {t("scheduling.assign.pendingNote")}
          </p>
          <div className="grid min-w-0 items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
            {board.unassigned.length > 0 && (
              <CourierColumn
                column={{
                  courier: null,
                  name: board.nameOf(null),
                  rows: board.unassigned,
                  peak: 0,
                  weekPending: 0,
                }}
                board={board}
              />
            )}
            {columns.map((column) => (
              <CourierColumn key={column.courier} column={column} board={board} />
            ))}
          </div>
        </>
      )}
    </ListPage>
  );
}
