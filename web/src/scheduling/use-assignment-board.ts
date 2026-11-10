import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { useCan } from "../session/use-can";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { useToast } from "../ui/toast-context";
import { loadTable } from "./load-table";
import { assignmentsOptions, weekLoadsOptions } from "./scheduling-queries";
import { useCouriers } from "./use-directories";
import { useMoveQuadrant } from "./use-scheduling-writes";
import { daysOfWeek, todayIn, weekStartOf } from "./week-dates";

type Row = Schemas["Assignment"];

export interface BoardColumn {
  /** `null` is the column of quadrants nobody covers. */
  courier: string | null;
  name: string;
  rows: Row[];
  /** Pending points of the busiest day of the week, against the daily target. */
  peak: number;
  weekPending: number;
}

/** Couriers as columns with their quadrants, load against target, moves with undo, drag state. */
export function useAssignmentBoard() {
  const { t } = useTranslation();
  const client = useApiClient();
  const identity = useSessionIdentity();
  const can = useCan();
  const me = useMe();
  const { showToast } = useToast();
  const move = useMoveQuadrant();
  const [dragging, setDragging] = useState<string | null>(null);
  const today = todayIn(me.organization?.timezone ?? "UTC");
  const week = weekStartOf(today, me.organization?.epi_week ?? "iso");
  const days = daysOfWeek(week);
  const query = useQuery(assignmentsOptions(client, identity));
  const weekLoads = useQuery(weekLoadsOptions(client, identity, week, days));
  const rows = query.data?.results ?? [];
  const { nameOf, ids } = useCouriers(rows.flatMap((row) => (row.courier ? [row.courier] : [])));
  const loads = loadTable(days, weekLoads.data);
  const peakOf = (id: string) => Math.max(0, ...days.map((day) => loads.get(id)?.get(day) ?? 0));
  const pendingOf = (id: string) => days.reduce((sum, day) => sum + (loads.get(id)?.get(day) ?? 0), 0);
  const columns: BoardColumn[] = [
    ...ids
      .map((id) => ({
        courier: id,
        name: nameOf(id),
        rows: rows.filter((row) => row.courier === id),
        peak: peakOf(id),
        weekPending: pendingOf(id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const unassigned = rows.filter((row) => row.courier === null);
  const options = ids.map((id) => ({ value: id, label: nameOf(id) }));

  const moveTo = (row: Row, courier: string | null, isUndo = false) => {
    if (row.courier === courier) return;
    move.mutate(
      { expected_revision: row.revision, quadrant_id: row.quadrant, courier_id: courier },
      {
        onSuccess: (result) => {
          const name = nameOf(courier);
          const message = isUndo
            ? t(courier === null ? "scheduling.assign.undoneNone" : "scheduling.assign.undone", {
                code: row.code,
                name,
              })
            : t(courier === null ? "scheduling.assign.movedNone" : "scheduling.assign.moved", {
                code: row.code,
                name,
              });
          showToast({
            message,
            tone: "success",
            ...(isUndo
              ? {}
              : {
                  action: {
                    label: t("scheduling.assign.undo"),
                    onAction: () => {
                      moveTo({ ...row, courier, revision: result.revision }, row.courier, true);
                    },
                  },
                }),
          });
        },
      },
    );
  };
  return {
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
    rows,
    columns,
    unassigned,
    options,
    target: rows[0]?.target ?? 0,
    canMove: can("schedule.manage"),
    savingId: move.isPending ? move.variables.quadrant_id : null,
    dragging,
    startDrag: setDragging,
    endDrag: () => {
      setDragging(null);
    },
    moveTo,
    nameOf,
  };
}

export type AssignmentBoard = ReturnType<typeof useAssignmentBoard>;
