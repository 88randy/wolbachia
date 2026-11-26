import { useSyncExternalStore } from "react";
import { useServices } from "../app/services-context.ts";
import { DEFAULT_TIME_ZONE } from "./format-time.ts";

/** The signed-in organization's IANA zone: every time the courier reads is shown in it. */
export function useOrganizationTimeZone(): string {
  const { auth } = useServices();
  const { profile } = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  return profile?.organization?.timezone ?? DEFAULT_TIME_ZONE;
}
