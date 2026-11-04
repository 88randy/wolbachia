import type { TableData } from "./table-types";

/** The part of a TanStack Query result a list needs (so tests and screens can pass a plain object). */
interface QueryLike<Answer> {
  data: Answer | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => unknown;
}

/** Answer of a page-number list endpoint: `{count, next, previous, results}`. */
interface PageAnswer<Row> {
  count: number;
  results: Row[];
}

/** Answer of a cursor list endpoint: `{next, previous, results}`. */
interface CursorAnswer<Row> {
  next: string | null;
  previous: string | null;
  results: Row[];
}

const NO_ROWS: never[] = [];

function baseOf<Answer>(query: QueryLike<Answer>) {
  return {
    isLoading: query.isPending && query.error === null,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Table data of a page-number list: the rows and "page X of N" come from the answer. */
export function pageTableData<Row>(
  query: QueryLike<PageAnswer<Row>>,
  page: number,
  pageSize: number,
): TableData<Row> {
  const { data } = query;
  return {
    ...baseOf(query),
    rows: data?.results ?? NO_ROWS,
    paging: data === undefined ? undefined : { mode: "page", page, pageSize, count: data.count },
  };
}

/** Table data of a cursor list: only whether a previous and a next page exist. */
export function cursorTableData<Row>(query: QueryLike<CursorAnswer<Row>>): TableData<Row> {
  const { data } = query;
  return {
    ...baseOf(query),
    rows: data?.results ?? NO_ROWS,
    paging:
      data === undefined ? undefined : { mode: "cursor", next: data.next, previous: data.previous },
  };
}
