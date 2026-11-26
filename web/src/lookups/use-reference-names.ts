import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { centersOptions } from "../centers/centers-query";
import { couriersOptions, quadrantNamesOptions } from "../scheduling/scheduling-queries";
import { useSessionIdentity } from "../session/use-session-identity";

/** What a screen shows when a name cannot be resolved: never an id. */
export const NO_NAME = "—";

type Id = string | null | undefined;

/** `centerName(id)`: the center name, or "—" while loading or when it cannot be read. */
export function useCenterName(): (id: Id) => string {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const centers = useQuery(centersOptions(client, identity)).data;
  const names = useMemo(
    () => new Map((centers ?? []).map((center) => [center.id, center.name])),
    [centers],
  );
  return useCallback((id: Id) => (id ? (names.get(id) ?? NO_NAME) : NO_NAME), [names]);
}

/** `quadrantName(id)`: the quadrant code (its human name), or "—". */
export function useQuadrantName(isAllowed = true): (id: Id) => string {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const options = quadrantNamesOptions(client, identity);
  const quadrants = useQuery({ ...options, enabled: options.enabled !== false && isAllowed }).data;
  const names = useMemo(
    () => new Map((quadrants ?? []).map((quadrant) => [quadrant.id, quadrant.code])),
    [quadrants],
  );
  return useCallback((id: Id) => (id ? (names.get(id) ?? NO_NAME) : NO_NAME), [names]);
}

/** `personName(userId)`: the display name of an operational person, or "—". */
export function usePersonName(): (id: Id) => string {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const people = useQuery(couriersOptions(client, identity)).data;
  const names = useMemo(
    () => new Map((people ?? []).map((person) => [person.id, person.display_name])),
    [people],
  );
  return useCallback((id: Id) => (id ? (names.get(id) ?? NO_NAME) : NO_NAME), [names]);
}

/** A server-resolved display name, or "—" when the API sent none. */
export function nameOrDash(name: string | null | undefined): string {
  return name && name.trim() !== "" ? name : NO_NAME;
}
