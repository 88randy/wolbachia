import type { Me } from "./me";

/** Home of the platform area (organizations of the platform). */
export const PLATFORM_HOME = "/platform";

/**
 * A platform admin signed in without any organization: they only see the platform area. The
 * backend still refuses every organization endpoint to them; this only routes the UI.
 */
export function isPlatformOnly(
  me: Pick<Me, "organization" | "organizations" | "is_platform_admin">,
) {
  return me.is_platform_admin && me.organization === null && me.organizations.length === 0;
}
