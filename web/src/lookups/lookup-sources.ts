import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";

/** One option of a picker filter: the id that goes in the URL and the human label shown. */
export interface LookupOption {
  value: string;
  label: string;
}

/**
 * Where a picker filter gets its options. `fetch` asks the API for the first page that matches
 * `search` (server-side search, never a full table in the browser). `permission` hides the
 * picker when the user cannot read that resource.
 */
export interface LookupSource {
  id: string;
  permission: string;
  fetch: (client: ApiClient, search: string, signal: AbortSignal) => Promise<LookupOption[]>;
}

const PAGE = 20;

function labelOf(code: string, name: string): string {
  return name && name !== code ? `${name} · ${code}` : code;
}

export const CENTER_LOOKUP: LookupSource = {
  id: "centers",
  permission: "center.read",
  fetch: async (client, search, signal) => {
    const page = unwrap(
      await client.GET("/api/v1/centers/", {
        params: { query: { page_size: PAGE, ...(search ? { search } : {}) } },
        signal,
      }),
    );
    return page.results.map((center) => ({
      value: center.id,
      label: labelOf(center.code, center.name),
    }));
  },
};

export const SUPPLY_LOOKUP: LookupSource = {
  id: "supplies",
  permission: "supply_type.read",
  fetch: async (client, search, signal) => {
    const page = unwrap(
      await client.GET("/api/v1/supply-types/", {
        params: { query: { page_size: PAGE, ...(search ? { search } : {}) } },
        signal,
      }),
    );
    return page.results.map((supply) => ({
      value: supply.id,
      label: labelOf(supply.code, supply.label),
    }));
  },
};

export const LOCATION_LOOKUP: LookupSource = {
  id: "locations",
  permission: "location.read",
  fetch: async (client, search, signal) => {
    const page = unwrap(
      await client.GET("/api/v1/locations/", {
        params: { query: { page_size: PAGE, ...(search ? { search } : {}) } },
        signal,
      }),
    );
    return page.results.map((location) => ({
      value: location.id,
      label: labelOf(location.code, location.name),
    }));
  },
};
