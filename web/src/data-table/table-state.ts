import type {
  FilterDefinition,
  ParsedTableState,
  Paging,
  SearchPatch,
  SortState,
  TableQueryConfig,
  TableState,
} from "./table-types";

/** Names of the query-string parameters the table owns besides its filters. */
export const PAGE_PARAM = "page";
export const CURSOR_PARAM = "cursor";
export const ORDERING_PARAM = "ordering";
export const INCLUDE_VOIDED_PARAM = "include_voided";

const MAX_PAGE_DIGITS = 6;
const MAX_CURSOR_LENGTH = 1024;
const PAGE_PATTERN = new RegExp(`^[1-9][0-9]{0,${String(MAX_PAGE_DIGITS - 1)}}$`);
const ORDERING_PATTERN = /^-?[a-z_][a-z0-9_]*$/;
// eslint-disable-next-line no-control-regex -- rejecting control characters is the point.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const TRUE = "true";

type RawSearch = Readonly<Record<string, unknown>>;

/** The router writes flat strings; a number or boolean (a route that coerced) reads as its text. */
function readString(search: RawSearch, key: string): string | undefined {
  const value = search[key];
  if (typeof value === "string") return value;
  return typeof value === "number" || typeof value === "boolean" ? String(value) : undefined;
}

/** A value that is not valid is reported (`isValid: false`) so the URL can be flagged. */
interface Reading<T> {
  value: T;
  isValid: boolean;
}

function readPage(raw: string | undefined, config: TableQueryConfig): Reading<number> {
  if (raw === undefined) return { value: 1, isValid: true };
  const isValid = config.paging === "page" && PAGE_PATTERN.test(raw);
  return { value: isValid ? Number(raw) : 1, isValid };
}

function readCursor(raw: string | undefined, config: TableQueryConfig): Reading<string | null> {
  if (raw === undefined) return { value: null, isValid: true };
  const isValid =
    config.paging === "cursor" && raw !== "" && raw.length <= MAX_CURSOR_LENGTH && !hasControl(raw);
  return { value: isValid ? raw : null, isValid };
}

function hasControl(text: string): boolean {
  return CONTROL_CHARACTERS.test(text);
}

/** `-created_at` is descending on `created_at`; anything else is ascending. */
export function parseOrdering(ordering: string | undefined): SortState | null {
  if (ordering === undefined || !ORDERING_PATTERN.test(ordering)) return null;
  return ordering.startsWith("-")
    ? { id: ordering.slice(1), direction: "desc" }
    : { id: ordering, direction: "asc" };
}

function readSort(raw: string | undefined, config: TableQueryConfig): Reading<SortState | null> {
  const fallback = parseOrdering(config.defaultOrdering);
  if (raw === undefined) return { value: fallback, isValid: true };
  const explicit = parseOrdering(raw);
  if (explicit !== null && config.sortableIds.includes(explicit.id)) {
    return { value: explicit, isValid: true };
  }
  return { value: fallback, isValid: false };
}

function readFilterValue(filter: FilterDefinition, raw: string): string | undefined {
  if (filter.kind === "select") {
    return filter.options.some((option) => option.value === raw) ? raw : undefined;
  }
  const text = raw.trim();
  if (
    filter.format === "positive-integer" &&
    (!/^[1-9][0-9]*$/.test(text) || !Number.isSafeInteger(Number(text)))
  )
    return undefined;
  return text !== "" && text.length <= filter.maxLength && !hasControl(text) ? text : undefined;
}

interface FilterReading {
  values: Record<string, string>;
  ignored: string[];
}

function readFilters(search: RawSearch, config: TableQueryConfig): FilterReading {
  const reading: FilterReading = { values: {}, ignored: [] };
  for (const filter of config.filters) {
    const raw = readString(search, filter.key);
    if (raw === undefined) continue;
    const value = readFilterValue(filter, raw);
    if (value !== undefined) reading.values[filter.key] = value;
    else if (raw.trim() !== "") reading.ignored.push(filter.key);
  }
  return reading;
}

function ownedKeys(config: TableQueryConfig): Set<string> {
  return new Set([
    PAGE_PARAM,
    CURSOR_PARAM,
    ORDERING_PARAM,
    INCLUDE_VOIDED_PARAM,
    ...config.filters.map((filter) => filter.key),
  ]);
}

/** Parameters of the URL that the table does not know at all. */
function unknownKeys(search: RawSearch, config: TableQueryConfig): string[] {
  const owned = ownedKeys(config);
  return Object.keys(search).filter((key) => !owned.has(key));
}

function readIncludeVoided(raw: string | undefined, config: TableQueryConfig): Reading<boolean> {
  if (raw === undefined) return { value: false, isValid: true };
  const isValid = config.supportsVoided && (raw === TRUE || raw === "false");
  return { value: isValid && raw === TRUE, isValid };
}

/**
 * Turns the address bar into a validated table state. The URL is user input: an unknown
 * parameter or an invalid value is ignored (never an error page) and its name is returned so
 * the screen can say so (issue #29, "unknown filter in the URL").
 */
export function readTableState(search: RawSearch, config: TableQueryConfig): ParsedTableState {
  const page = readPage(readString(search, PAGE_PARAM), config);
  const cursor = readCursor(readString(search, CURSOR_PARAM), config);
  const rawOrdering = readString(search, ORDERING_PARAM);
  const sort = readSort(rawOrdering, config);
  const voided = readIncludeVoided(readString(search, INCLUDE_VOIDED_PARAM), config);
  const filters = readFilters(search, config);
  const invalid = [
    ...(page.isValid ? [] : [PAGE_PARAM]),
    ...(cursor.isValid ? [] : [CURSOR_PARAM]),
    ...(sort.isValid ? [] : [ORDERING_PARAM]),
    ...(voided.isValid ? [] : [INCLUDE_VOIDED_PARAM]),
  ];
  return {
    state: {
      page: page.value,
      cursor: cursor.value,
      sort: sort.value,
      isSortExplicit: rawOrdering !== undefined && sort.isValid,
      filters: filters.values,
      includeVoided: voided.value,
    },
    ignored: [...unknownKeys(search, config), ...invalid, ...filters.ignored].sort(),
  };
}

const FIRST_PAGE: SearchPatch = { [PAGE_PARAM]: undefined, [CURSOR_PARAM]: undefined };

/** Changing the filters or the order starts again from the first page. */
export function patchForFilter(key: string, value: string | undefined): SearchPatch {
  return { ...FIRST_PAGE, [key]: value };
}

export function patchForClearFilters(config: TableQueryConfig): SearchPatch {
  const cleared = Object.fromEntries(config.filters.map((filter) => [filter.key, undefined]));
  return { ...FIRST_PAGE, ...cleared };
}

export function patchForIncludeVoided(include: boolean): SearchPatch {
  return { ...FIRST_PAGE, [INCLUDE_VOIDED_PARAM]: include ? TRUE : undefined };
}

export function patchForPage(page: number): SearchPatch {
  return { ...FIRST_PAGE, [PAGE_PARAM]: page <= 1 ? undefined : String(page) };
}

export function patchForCursor(cursor: string | null): SearchPatch {
  return { ...FIRST_PAGE, [CURSOR_PARAM]: cursor ?? undefined };
}

/**
 * The ordering a click on a column header asks for: ascending first, then descending, then back
 * to the default order. `undefined` removes the parameter.
 */
export function nextOrdering(
  current: SortState | null,
  columnId: string,
  defaultOrdering: string | undefined,
): string | undefined {
  if (current?.id !== columnId) return columnId;
  if (current.direction === "asc") return `-${columnId}`;
  return defaultOrdering === `-${columnId}` ? columnId : undefined;
}

export function patchForSort(ordering: string | undefined): SearchPatch {
  return { ...FIRST_PAGE, [ORDERING_PARAM]: ordering };
}

/** Drops from the URL the parameters the table ignored. */
export function patchForIgnored(ignored: readonly string[]): SearchPatch {
  return Object.fromEntries(ignored.map((key) => [key, undefined]));
}

/** Applies a patch to the current search: `undefined` removes the key, the rest is kept. */
export function applyPatch(search: RawSearch, patch: SearchPatch): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(search)) {
    if (typeof value === "string") next[key] = value;
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) Reflect.deleteProperty(next, key);
    else next[key] = value;
  }
  return next;
}

/**
 * Filters, ordering and `include_voided` as API query parameters (the same names as in the URL).
 * The ordering is only sent when the URL has one: otherwise the API applies its own default.
 */
export function toFilterParams(state: TableState): Record<string, string | boolean> {
  const params: Record<string, string | boolean> = { ...state.filters };
  if (state.isSortExplicit && state.sort !== null) {
    params[ORDERING_PARAM] = `${state.sort.direction === "desc" ? "-" : ""}${state.sort.id}`;
  }
  if (state.includeVoided) params[INCLUDE_VOIDED_PARAM] = true;
  return params;
}

/**
 * The cursor of a DRF `next` / `previous` link (a URL carrying `?cursor=`), or `null` when there
 * is no link. The client never builds or reads the cursor's content: it is opaque.
 */
export function cursorOfLink(link: string | null): string | null {
  if (link === null) return null;
  try {
    return new URL(link, "http://api.invalid").searchParams.get(CURSOR_PARAM);
  } catch {
    return null;
  }
}

/** Where "Previous" or "Next" leads: a page number, or an opaque cursor (`null` = first page). */
export type PagerMove = { kind: "page"; page: number } | { kind: "cursor"; cursor: string | null };

export interface PagerPlan {
  previous: PagerMove | null;
  next: PagerMove | null;
  /** Page mode only: "Page X of Y". */
  position: { page: number; pages: number } | null;
}

/**
 * What the pager offers for an answer. In cursor mode a link that exists but carries no cursor
 * (DRF's link to the first page) is a move to the first page, so "no link" is told by the link
 * itself, not by its cursor.
 */
export function pagerPlanOf(paging: Paging): PagerPlan {
  if (paging.mode === "cursor") {
    return {
      previous:
        paging.previous === null ? null : { kind: "cursor", cursor: cursorOfLink(paging.previous) },
      next: paging.next === null ? null : { kind: "cursor", cursor: cursorOfLink(paging.next) },
      position: null,
    };
  }
  const pages = pageCountOf(paging.count, paging.pageSize);
  return {
    previous: paging.page > 1 ? { kind: "page", page: paging.page - 1 } : null,
    next: paging.page < pages ? { kind: "page", page: paging.page + 1 } : null,
    position: { page: paging.page, pages },
  };
}

export function pageCountOf(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

/** 1-based first and last position of the rows of a page, e.g. `{ from: 21, to: 40 }`. */
export function rangeOf(page: number, pageSize: number, rowsOnPage: number) {
  const from = rowsOnPage === 0 ? 0 : (page - 1) * pageSize + 1;
  return { from, to: from === 0 ? 0 : from + rowsOnPage - 1 };
}
