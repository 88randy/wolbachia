import { useMe } from "../session/use-me";
import { voidLimitsOf } from "./void-limits";
import type { VoidLimits } from "./void-limits";

/** The void reason limits of the server, for screens behind the authenticated route. */
export function useVoidLimits(): VoidLimits {
  return voidLimitsOf(useMe());
}
