import type { Row, RowData } from "@tanstack/react-table";
import { TableRowFrame } from "./TableRowFrame";
import { useId, useState } from "react";
import type { ReactNode } from "react";
import type { LinkProps } from "@tanstack/react-router";
import { useRowClick } from "./use-row-click";
import { classNames } from "../styles/class-names";
import { RowCells } from "./RowCells";
import { RowSelectCell } from "./RowSelectCell";
import { RowExpandButton } from "./RowExpandButton";
import { RowDetail } from "./RowDetail";
import { RowActionCell } from "./RowActionCell";
import styles from "./data-table.module.css";
import type { DataTableColumn, RowSelectionConfig, VoidInfo } from "./table-types";
import type { DataTableFeatures } from "./use-data-table";
export interface DataTableRowProps<TRow extends RowData> {
  row: Row<DataTableFeatures, TRow>;
  columns: readonly DataTableColumn<TRow>[];
  voidInfo: VoidInfo | null;
  selection: RowSelectionConfig<TRow> | undefined;
  renderDetail?: (row: TRow) => ReactNode;
  rowActions?: (row: TRow) => ReactNode;
  rowLink?: (row: TRow) => LinkProps | undefined;
}
export function DataTableRow<TRow extends RowData>(props: DataTableRowProps<TRow>) {
  const { row, columns, voidInfo, selection, renderDetail, rowActions, rowLink } = props;
  const onRowClick = useRowClick(rowLink?.(row.original));
  const [expanded, setExpanded] = useState(false);
  const detailId = useId();
  const className = classNames(row.getIsSelected() && styles.selected, voidInfo && styles.voided);
  const leading = renderDetail && (
    <RowExpandButton
      expanded={expanded}
      controls={detailId}
      onToggle={() => {
        setExpanded((previous) => !previous);
      }}
    />
  );
  const count = columns.length + Number(selection !== undefined) + Number(rowActions !== undefined);
  return (
    <>
      <TableRowFrame id={row.id} className={className} onClick={onRowClick}>
        {selection && <RowSelectCell row={row} label={selection.rowLabel(row.original)} />}
        <RowCells row={row} columns={columns} voidInfo={voidInfo} leading={leading} />
        {rowActions && <RowActionCell>{rowActions(row.original)}</RowActionCell>}
      </TableRowFrame>
      {renderDetail && (
        <RowDetail id={detailId} expanded={expanded} columns={count}>
          {expanded && renderDetail(row.original)}
        </RowDetail>
      )}
    </>
  );
}
