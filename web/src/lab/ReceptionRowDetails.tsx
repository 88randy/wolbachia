import type { ReceptionRow } from "./reception-query";
import { ReceptionMetadata } from "./ReceptionMetadata";
export function ReceptionRowDetails({ row }: { row: ReceptionRow }) {
  return row.readingId ? (
    <ReceptionMetadata bagId={row.bagId} readingId={row.readingId} />
  ) : (
    <p>{row.discrepancy?.reason}</p>
  );
}
