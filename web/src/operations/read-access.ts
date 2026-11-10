import { ApiError } from "@wolbachia/api-client";
import { pageTableData } from "../data-table/table-data";

/** A definitive read denial retires visible records; a transient refresh failure does not. */
export function isReadDenied(error: unknown): boolean {
  return error instanceof ApiError && [403, 404].includes(error.status);
}

/** Apply the same access rule to both operational lists, retaining their server paging. */
export function operationTableData<Row>(
  query: Parameters<typeof pageTableData<Row>>[0],
  page: number,
  size: number,
) {
  return pageTableData(
    { ...query, data: isReadDenied(query.error) ? undefined : query.data },
    page,
    size,
  );
}
