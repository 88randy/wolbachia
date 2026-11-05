import { useMemo } from "react";
import type { DataTableColumn } from "../data-table/table-types";
import { useFormatDateTime } from "../format/use-format-date-time";
import { useFormatCalendarDate, useFormatNumber } from "../format/use-formatters";
import { useParameterLabels } from "./parameter-labels";
import type { RuleParameter, RuleParameterVersion } from "./rules-query";
import styles from "./rules.module.css";
import { useAuthorLabel } from "./use-author-label";
import { VersionStatusBadge } from "./VersionStatusBadge";
import { VoidVersionButton } from "./VoidVersionButton";

type Column = DataTableColumn<RuleParameterVersion>;

/** What the cells write: the value with its unit, a calendar day, a moment and an author. */
interface Writers {
  value: (version: RuleParameterVersion) => string;
  day: (isoDate: string) => string;
  moment: (iso: string) => string;
  author: (userId: string | null) => string;
}

function detailColumns(write: Writers): Column[] {
  return [
    { id: "value", headerKey: "rules.history.value", align: "end", cell: write.value },
    {
      id: "effective",
      headerKey: "rules.history.effective",
      cell: (version) => write.day(version.effective_date),
    },
    {
      id: "status",
      headerKey: "rules.history.status",
      cell: (version) => <VersionStatusBadge status={version.status} />,
    },
    {
      id: "reason",
      headerKey: "rules.history.reason",
      cell: (version) => <span className={styles.reasonText}>{version.reason}</span>,
    },
    {
      id: "author",
      headerKey: "rules.history.author",
      cell: (version) => write.author(version.created_by),
    },
    {
      id: "created",
      headerKey: "rules.history.created",
      cell: (version) => write.moment(version.created_at),
    },
  ];
}

interface VersionColumnsOptions {
  parameter: RuleParameter;
  /** Adds the "Actions" column (the user holds `rule_parameter_version.void`). */
  canVoid: boolean;
  onVoid: (version: RuleParameterVersion) => void;
  blockedNoteId: string;
}

function actionColumn({ onVoid, blockedNoteId }: VersionColumnsOptions): Column {
  return {
    id: "actions",
    headerKey: "rules.history.actions",
    cell: (version) => (
      <VoidVersionButton version={version} onVoid={onVoid} blockedNoteId={blockedNoteId} />
    ),
  };
}

/**
 * Columns of the history: value with its unit, the day it applies from, status, reason, author
 * and when it was recorded, plus "Void" for who may. Read only otherwise.
 */
export function useVersionColumns(options: VersionColumnsOptions): readonly Column[] {
  const labels = useParameterLabels();
  const formatNumber = useFormatNumber();
  const formatCalendarDate = useFormatCalendarDate();
  const formatDateTime = useFormatDateTime();
  const authorLabel = useAuthorLabel();
  const { parameter, canVoid, onVoid, blockedNoteId } = options;
  return useMemo(() => {
    const write: Writers = {
      value: (version) => `${formatNumber(version.value)} ${labels.unit(parameter.unit)}`,
      day: formatCalendarDate,
      moment: formatDateTime,
      author: authorLabel,
    };
    const columns = detailColumns(write);
    return canVoid
      ? [...columns, actionColumn({ parameter, canVoid, onVoid, blockedNoteId })]
      : columns;
  }, [
    parameter,
    canVoid,
    onVoid,
    blockedNoteId,
    labels,
    formatNumber,
    formatCalendarDate,
    formatDateTime,
    authorLabel,
  ]);
}
