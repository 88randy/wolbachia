import { useMe } from "../session/use-me";
import { DEFAULT_TIME_ZONE } from "./time-zone";

/** The active organization's IANA zone: every date, time and "today" of the web uses it. */
export function useOrganizationTimeZone(): string {
  return useMe().organization?.timezone ?? DEFAULT_TIME_ZONE;
}
