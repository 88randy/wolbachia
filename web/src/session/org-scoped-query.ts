import { queryOptions } from "@tanstack/react-query";
import type { QueryFunction, QueryKey } from "@tanstack/react-query";
import type { Me } from "./me";

/** First element of every org-scoped key; `organization-cache` drops everything but `["me"]`. */
export const ORG_SCOPE = "org";

/** Who the data belongs to: the user and the organization of the session that asked for it. */
export interface SessionIdentity {
  userId: string;
  organizationSlug: string;
}

export function sessionIdentityOf(me: Pick<Me, "user" | "organization">): SessionIdentity {
  return { userId: me.user.id, organizationSlug: me.organization?.slug ?? "" };
}

/** `["org", userId, organizationSlug]`: the prefix of every org-scoped key. */
function scopeOf(identity: SessionIdentity): readonly [string, string, string] {
  return [ORG_SCOPE, identity.userId, identity.organizationSlug];
}

function isSameScope(identity: SessionIdentity, key: QueryKey | undefined): boolean {
  const scope = scopeOf(identity);
  return key !== undefined && scope.every((part, index) => key[index] === part);
}

interface OrgScopedOptions<TData> {
  /** The rest of the key: resource and parameters (`["devices", "list", page]`). */
  key: readonly unknown[];
  queryFn: QueryFunction<TData>;
}

/**
 * The only way to define a query whose answer depends on the user or the organization (every
 * list of the back-office). It does two things that must never be forgotten:
 *
 * - the key starts with the session identity, so an answer asked for under another identity can
 *   never be read for this one, and a late response from the old identity lands in the old key;
 * - the previous page is kept as placeholder (no flicker while paging) only when it was loaded
 *   under the SAME identity. `keepPreviousData` alone would keep the old organization's rows on
 *   screen while the new request is pending (#82).
 *
 * `org-scoped-query.test.ts` fails when a query is defined without it.
 */
export function orgScopedQueryOptions<TData>(
  identity: SessionIdentity,
  { key, queryFn }: OrgScopedOptions<TData>,
) {
  return queryOptions<TData>({
    queryKey: [...scopeOf(identity), ...key],
    queryFn,
    placeholderData: (previous, previousQuery) =>
      isSameScope(identity, previousQuery?.queryKey) ? previous : undefined,
  });
}
