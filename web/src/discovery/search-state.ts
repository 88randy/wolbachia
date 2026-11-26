import { isRecordType } from "./discovery-query";
import type { RecordType } from "./discovery-query";

export const MIN_QUERY_LENGTH = 2;
export const SUMMARY_PAGE_SIZE = 5;
export const FULL_PAGE_SIZE = 25;

/** What the address says about the search; shareable and bookmarkable. */
export interface SearchState {
  q: string;
  type: RecordType | undefined;
  includeVoided: boolean;
  page: number;
}

type RawSearch = Readonly<Record<string, string | undefined>>;

export function readSearchState(search: RawSearch): SearchState {
  const type = search["type"];
  const page = Number.parseInt(search["page"] ?? "1", 10);
  return {
    q: (search["q"] ?? "").slice(0, 50),
    type: isRecordType(type) ? type : undefined,
    includeVoided: search["voided"] === "true",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Only what differs from the defaults is written to the address. */
export function toSearchParams(state: SearchState): Record<string, string> {
  return {
    ...(state.q === "" ? {} : { q: state.q }),
    ...(state.type === undefined ? {} : { type: state.type }),
    ...(state.includeVoided ? { voided: "true" } : {}),
    ...(state.page > 1 ? { page: String(state.page) } : {}),
  };
}
