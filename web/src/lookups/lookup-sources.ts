import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { PERSON_NAME_PERMISSIONS, QUADRANT_NAME_PERMISSIONS } from "./lookup-permissions";
import type { RequiredPermission } from "./lookup-permissions";

/** One option of a picker filter: the id that goes in the URL and the human label shown. */
export interface LookupOption {
  value: string;
  /** The human name, shown first. */
  label: string;
  /** Secondary text (the human code), shown small and muted. */
  detail?: string;
}

/**
 * Where a picker filter gets its options. `fetch` asks the API for the first page that matches
 * `search` (server-side search, never a full table in the browser). `permission` hides the
 * picker when the user cannot read that resource (a list: any one code is enough).
 */
export interface LookupSource {
  id: string;
  permission: RequiredPermission;
  fetch: (client: ApiClient, search: string, signal: AbortSignal) => Promise<LookupOption[]>;
}

const PAGE = 20;

function optionOf(value: string, code: string, name: string): LookupOption {
  return name && name !== code ? { value, label: name, detail: code } : { value, label: code };
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
    return page.results.map((center) => optionOf(center.id, center.code, center.name));
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
    return page.results.map((supply) => optionOf(supply.id, supply.code, supply.label));
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
    return page.results.map((location) => optionOf(location.id, location.code, location.name));
  },
};

const LOCAL_PAGE = 100;

function matches(label: string, search: string): boolean {
  return label.toLowerCase().includes(search.trim().toLowerCase());
}

/** Active staff by name, from the names-only lookup (server-side search). */
export const PERSON_LOOKUP: LookupSource = {
  id: "people",
  permission: PERSON_NAME_PERMISSIONS,
  fetch: async (client, search, signal) => {
    const page = unwrap(
      await client.GET("/api/v1/lookups/users/", {
        params: { query: { page_size: PAGE, ...(search ? { search } : {}) } },
        signal,
      }),
    );
    return page.results.map((person) => ({ value: person.id, label: person.display_name }));
  },
};

/** Quadrants by code, from the codes-only lookup (server-side search). */
export const QUADRANT_LOOKUP: LookupSource = {
  id: "quadrants",
  permission: QUADRANT_NAME_PERMISSIONS,
  fetch: async (client, search, signal) => {
    const page = unwrap(
      await client.GET("/api/v1/lookups/quadrants/", {
        params: { query: { page_size: PAGE, ...(search ? { search } : {}) } },
        signal,
      }),
    );
    return page.results.map((quadrant) => ({ value: quadrant.id, label: quadrant.code }));
  },
};

/** External PCR laboratories by name. The endpoint has no search, so the page is filtered here. */
export const EXTERNAL_LAB_LOOKUP: LookupSource = {
  id: "external-labs",
  permission: "pcr.read",
  fetch: async (client, search, signal) => {
    const page = unwrap(
      await client.GET("/api/v1/external-labs/", {
        params: { query: { page_size: LOCAL_PAGE } },
        signal,
      }),
    );
    return page.results
      .map((lab) => ({ value: lab.id, label: lab.name }))
      .filter((option) => matches(option.label, search))
      .slice(0, PAGE);
  },
};
