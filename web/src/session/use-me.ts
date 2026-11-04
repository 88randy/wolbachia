import { useSuspenseQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import type { Me } from "./me";
import { meQueryOptions } from "./me-query";

/**
 * The signed-in user. Only for screens behind the authenticated route: its guard has already
 * loaded `/me/`, so this never shows a loading state of its own.
 */
export function useMe(): Me {
  return useSuspenseQuery(meQueryOptions(useApiClient())).data;
}
