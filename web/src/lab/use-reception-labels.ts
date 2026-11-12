import { bagLabel } from "../labels/label-records";
import { useRowLabels } from "../labels/use-row-labels";
import type { ReceptionRow } from "./reception-query";

/** Label printing of the bag reception list: a row with no bag code has nothing to print. */
export function useReceptionLabels() {
  return useRowLabels<ReceptionRow>({
    toRecord: (row, text) =>
      row.code === null ? null : bagLabel({ code: row.code, createdAt: row.createdAt }, text),
    rowLabel: (row) => row.code ?? "",
  });
}
