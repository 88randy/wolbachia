import { createPortal } from "react-dom";
import type { LabelFormat } from "./label-formats";
import type { LabelRecord } from "./label-record";
import { LabelSheet } from "./LabelSheet";
import styles from "./labels.module.css";

/**
 * The print layout: a copy of the sheet placed straight under <body>. On screen it is hidden; when
 * printing, the print stylesheet hides everything else, so only the labels reach the printer.
 */
export function LabelPrintPortal({
  format,
  labels,
}: {
  format: LabelFormat;
  labels: readonly LabelRecord[];
}) {
  return createPortal(
    <div className={styles["printRoot"]} data-testid="label-print-root">
      <LabelSheet format={format} labels={labels} mode="print" />
    </div>,
    document.body,
  );
}
