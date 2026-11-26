import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { PERSON_NAME_PERMISSIONS, QUADRANT_NAME_PERMISSIONS } from "./lookup-permissions";
import type { RequiredPermission } from "./lookup-permissions";

/** Kinds of referenced records the UI can name. */
export type EntityKind = "center" | "quadrant" | "location" | "supply" | "user";

export interface EntityLabel {
  /** The human name. */
  label: string;
  /** Secondary text (the human code), optional. */
  detail?: string;
}

interface EntitySource {
  /** Permission needed to read the record (a list: any one); without it the name is "—". */
  permission: RequiredPermission;
  fetchOne: (client: ApiClient, id: string, signal: AbortSignal) => Promise<EntityLabel>;
}

function named(name: string | undefined, code: string): EntityLabel {
  return name && name !== code ? { label: name, detail: code } : { label: code };
}

/** One detail request per id, cached by React Query; the id never reaches the screen. */
export const ENTITY_SOURCES: Record<EntityKind, EntitySource> = {
  center: {
    permission: "center.read",
    fetchOne: async (client, id, signal) => {
      const row = unwrap(
        await client.GET("/api/v1/centers/{id}/", { params: { path: { id } }, signal }),
      );
      return named(row.name, row.code);
    },
  },
  quadrant: {
    permission: QUADRANT_NAME_PERMISSIONS,
    fetchOne: async (client, id, signal) => {
      const row = unwrap(
        await client.GET("/api/v1/lookups/quadrants/{id}/", { params: { path: { id } }, signal }),
      );
      return { label: row.code };
    },
  },
  location: {
    permission: "location.read",
    fetchOne: async (client, id, signal) => {
      const row = unwrap(
        await client.GET("/api/v1/locations/{id}/", { params: { path: { id } }, signal }),
      );
      return named(row.name, row.code);
    },
  },
  supply: {
    permission: "supply_type.read",
    fetchOne: async (client, id, signal) => {
      const row = unwrap(
        await client.GET("/api/v1/supply-types/{id}/", { params: { path: { id } }, signal }),
      );
      return named(row.label, row.code);
    },
  },
  user: {
    permission: PERSON_NAME_PERMISSIONS,
    fetchOne: async (client, id, signal) => {
      const row = unwrap(
        await client.GET("/api/v1/lookups/users/{id}/", { params: { path: { id } }, signal }),
      );
      return { label: row.display_name };
    },
  },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a value is a raw id that must never be shown. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
