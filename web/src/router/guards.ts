import { ApiError } from "@wolbachia/api-client";
import { redirect } from "@tanstack/react-router";
import type { AnyRedirect } from "@tanstack/react-router";
import { canOpenArea } from "./area-access";
import type { Area, AreaId } from "./areas";
import type { Me } from "../session/me";
import { loadMe } from "../session/me-query";
import type { RouterContext } from "./router-context";

const HOME = "/";

/** Thrown by an area's guard when the user lacks its permission; the area renders "no permission". */
export class ForbiddenError extends Error {
  readonly areaId: AreaId;

  constructor(areaId: AreaId) {
    super(`The user may not open the "${areaId}" area.`);
    this.name = "ForbiddenError";
    this.areaId = areaId;
  }
}

interface GuardArgs {
  context: RouterContext;
  location: { href: string };
}

/**
 * TanStack Router stops a navigation by throwing the object `redirect()` returns (documented
 * usage). It is not an `Error`, so this is the one place where that rule is waived.
 */
function leaveFor(destination: AnyRedirect): never {
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- router redirects are thrown by design.
  throw destination;
}

function signIn(args: GuardArgs, notice?: "no-membership"): never {
  const target = args.location.href;
  return leaveFor(
    redirect({
      to: "/login",
      search: {
        ...(target === HOME ? {} : { redirect: target }),
        ...(notice ? { notice } : {}),
      },
    }),
  );
}

/**
 * Loads `/me/` (from the cache when fresh, requested again when stale) or sends the visitor to
 * sign in, remembering where they were going. Used by every route behind the session.
 */
export async function requireSession(args: GuardArgs): Promise<Me> {
  try {
    return await loadMe(args.context.queryClient, args.context.client);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) return signIn(args);
    if (error.code === "no_active_membership") return signIn(args, "no-membership");
    throw error;
  }
}

/** Like `requireSession`, and a user who still has to choose an organization goes to do so. */
export async function requireOrganization(args: GuardArgs): Promise<{ me: Me }> {
  const me = await requireSession(args);
  if (me.organization !== null) return { me };
  const target = args.location.href;
  return leaveFor(
    redirect({ to: "/select-organization", search: target === HOME ? {} : { redirect: target } }),
  );
}

/** A single organization needs no chooser: whoever has only one never sees the screen. */
export async function requireOrganizationChoice(args: GuardArgs): Promise<void> {
  const me = await requireSession(args);
  if (me.organization !== null && me.organizations.length < 2) leaveFor(redirect({ to: HOME }));
}

/** Guard of one area: the permissions it declares, against `/me/`. */
export function requireAreaAccess(area: Area, me: Me): void {
  if (!canOpenArea(me, area)) throw new ForbiddenError(area.id);
}
