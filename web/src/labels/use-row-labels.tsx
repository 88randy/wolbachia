import { PrintLabelsButton } from "./PrintLabelsButton";
import type { RowSelectionConfig } from "../data-table/table-types";
import type { LabelRecord } from "./label-record";
import type { LabelText } from "./label-records";
import { useLabelText } from "./use-label-text";

interface RowLabelsConfig<Row> {
  /** The label of a row, or null when the row has nothing to print (no code, voided). */
  toRecord: (row: Row, text: LabelText) => LabelRecord | null;
  /** Accessible name of the row's checkbox: its human code. */
  rowLabel: (row: Row) => string;
}

/**
 * What a list needs to print labels: a "print this page" button for the toolbar and the row
 * selection (checkboxes plus "print the selected" in the selection bar).
 */
export function useRowLabels<Row>({ toRecord, rowLabel }: RowLabelsConfig<Row>) {
  const text = useLabelText();
  const toRecords = (rows: readonly Row[]): LabelRecord[] =>
    rows.flatMap((row) => {
      const record = toRecord(row, text);
      return record === null ? [] : [record];
    });
  const selection: RowSelectionConfig<Row> = {
    rowLabel,
    isSelectable: (row) => toRecord(row, text) !== null,
    renderActions: (rows) => (
      <PrintLabelsButton records={toRecords(rows)} labelKey="labels.action.printSelected" />
    ),
  };
  const pageAction = (rows: readonly Row[]) => (
    <PrintLabelsButton records={toRecords(rows)} labelKey="labels.action.printPage" />
  );
  return { selection, pageAction, toRecords };
}
