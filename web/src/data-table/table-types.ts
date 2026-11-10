import type { MessageKey } from "@wolbachia/i18n";
import type { LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** One option of a `select` filter. `value` is what goes in the URL and to the API. */
export interface FilterOption {
  value: string;
  labelKey: MessageKey;
}

interface FilterBase {
  /** Query-string name, also the API parameter name (`?status=open`). */
  key: string;
  labelKey: MessageKey;
}

export interface SelectFilter extends FilterBase {
  kind: "select";
  options: readonly FilterOption[];
  /** `segmented`: quick filter tabs in the toolbar row (one per list). Else a dropdown in "Filtros". */
  presentation?: "segmented";
  /** The value the API applies when the URL has none; shown as a "(predeterminado)" chip. */
  defaultValue?: string;
}

/**
 * Where a text filter goes in the FilterBar:
 * - `search` (default for the key `search`, or the first plain text filter): the live search box;
 * - `text`: a live text box inside "Filtros";
 * - `date-from` / `date-to`: the two ends of ONE calendar range picker inside "Filtros";
 * - `hidden`: URL only (ids from links such as a number that opens a filtered list). It is never
 *   typed by the user and its chip shows the filter name, never the raw id.
 */
export type TextFilterInput = "search" | "text" | "date-from" | "date-to" | "hidden";

export interface TextFilter extends FilterBase {
  kind: "text";
  /** Longest accepted value; longer ones in the URL are ignored. */
  maxLength: number;
  format?: "positive-integer";
  input?: TextFilterInput;
  /** Date range ends: `date` sends `YYYY-MM-DD`; `datetime` sends local midnight with offset. */
  dateFormat?: "date" | "datetime";
}

export type FilterDefinition = SelectFilter | TextFilter;

export type PagingMode = "page" | "cursor";

/** What a list screen declares about its table: the shape of its query string. */
export interface TableQueryConfig {
  paging: PagingMode;
  /** Rows per page; sent to the API as `page_size` in page mode. */
  pageSize: number;
  filters: readonly FilterDefinition[];
  /** Column ids the API can order by (`?ordering=<id>` or `-<id>`). */
  sortableIds: readonly string[];
  sortOptions?: readonly FilterOption[];
  /** Ordering the API applies when the URL has none, e.g. `-created_at`. */
  defaultOrdering?: string;
  /** Whether the list endpoint understands `?include_voided=true`. */
  supportsVoided: boolean;
  limitationsKey?: MessageKey;
}

export type SortDirection = "asc" | "desc";

export interface SortState {
  id: string;
  direction: SortDirection;
}

/** The table state held in the address bar, already validated. */
export interface TableState {
  /** Page mode: 1-based. Cursor mode: always 1 (unused). */
  page: number;
  /** Cursor mode: opaque cursor of the page, `null` for the first one. */
  cursor: string | null;
  /** Effective order: the one in the URL, else the default of the config. */
  sort: SortState | null;
  /** Whether the ordering was written in the URL (only then is it sent to the API). */
  isSortExplicit: boolean;
  /** Valid filter values by key; filters with no value are absent. */
  filters: Readonly<Record<string, string>>;
  includeVoided: boolean;
}

/** A state plus the names of URL parameters that were unknown or invalid and are ignored. */
export interface ParsedTableState {
  state: TableState;
  ignored: readonly string[];
}

/** Changes to the URL: `undefined` removes a key. Values are already strings. */
export type SearchPatch = Readonly<Record<string, string | undefined>>;

/** Everything the table and its filter bar need from the address bar. */
export interface TableController {
  config: TableQueryConfig;
  state: TableState;
  ignored: readonly string[];
  hasActiveFilters: boolean;
  toggleSort: (columnId: string) => void;
  setOrdering: (ordering: string | undefined) => void;
  goToPage: (page: number) => void;
  goToCursor: (cursor: string | null) => void;
  setFilter: (key: string, value: string | undefined) => void;
  /** Several filters in one URL change (a date range). Optional for hand-built controllers. */
  setFilters?: (patch: SearchPatch) => void;
  clearFilters: () => void;
  setIncludeVoided: (include: boolean) => void;
  dropIgnored: () => void;
}

/** Paging information of the answer in view. */
export type Paging =
  | { mode: "page"; page: number; pageSize: number; count: number }
  | { mode: "cursor"; next: string | null; previous: string | null };

/** What a list screen hands to the table: the rows in view and where the request stands. */
export interface TableData<Row> {
  rows: readonly Row[];
  /** `undefined` until the first answer arrives. */
  paging: Paging | undefined;
  /** First load: nothing to show yet. */
  isLoading: boolean;
  /** Any request in flight (a new page keeps the previous rows in view meanwhile). */
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

/** Row selection: shown only when the screen passes it. */
export interface RowSelectionConfig<Row> {
  /** Accessible name of a row's checkbox, e.g. its code. */
  rowLabel: (row: Row) => string;
  isSelectable?: (row: Row) => boolean;
  /** Actions for the selected rows of the current page. */
  renderActions?: (rows: readonly Row[]) => ReactNode;
}

export interface VoidInfo {
  reason: string;
  /** Optional free text for a catalog reason, displayed separately from its label. */
  note?: string;
  /** Already formatted for display (a name, never an id). */
  author: string;
  /** Already formatted in the organization's time zone; shown only when present. */
  when?: string;
}

export interface DataTableColumn<Row> {
  /** Also the ordering key sent to the API when the column is sortable. */
  id: string;
  headerKey: MessageKey;
  cell: (row: Row) => ReactNode;
  /** Numbers: right-aligned with tabular figures. */
  align?: "start" | "end";
  /** Wraps the cell in a link (row link, or the filtered list behind a number). */
  link?: (row: Row) => LinkProps | undefined;
}

/** Optional presentation only: these never sort/filter server-owned rows. */
export interface TablePresentation<Row> {
  embedded?: boolean;
  groupOf?: (row: Row) => { id: string; label: string };
  renderDetail?: (row: Row) => ReactNode;
  rowActions?: (row: Row) => ReactNode;
  density?: "comfortable" | "compact";
  onDensityChange?: (density: "comfortable" | "compact") => void;
}
