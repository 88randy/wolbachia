import { CancelledError, queryOptions } from "@tanstack/react-query";
import type { QueryFunction, QueryKey } from "@tanstack/react-query";
import type { Me } from "./me";
import { currentRevision } from "./session-revision";

/** First element of every org-scoped key; `organization-cache` drops everything but `["me"]`. */
export const ORG_SCOPE = "org";

/**
 * Who the data belongs to: the user and the organization of the session that asked for it, the
 * session revision it was asked under, and whether the tab is sure about it (`isSettled` is false
 * while it waits for `/me/` after another tab changed the shared session).
 */
export interface SessionIdentity {
  userId: string;
  organizationSlug: string;
  revision: number;
  isSettled: boolean;
}

export function sessionIdentityOf(
  me: Pick<Me, "user" | "organization">,
  revision: number,
  isSettled: boolean,
): SessionIdentity {
  return { userId: me.user.id, organizationSlug: me.organization?.slug ?? "", revision, isSettled };
}

/** `["org", userId, organizationSlug, revision]`: the prefix of every org-scoped key. */
function scopeOf(identity: SessionIdentity): readonly [string, string, string, number] {
  return [ORG_SCOPE, identity.userId, identity.organizationSlug, identity.revision];
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
 * list of the back-office). It does three things that must never be forgotten:
 *
 * - the key starts with the session identity and revision, so an answer asked for under another
 *   identity can never be read for this one;
 * - an answer that arrives after the session changed (a login, a sign-out, or another tab doing
 *   either) is dropped, and the query waits while the tab reconciles with `/me/`;
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
    // Waits for `/me/` after another tab changed the session: the cached identity may be stale.
    enabled: identity.isSettled,
    queryFn: async (context) => {
      const data = await queryFn(context);
      // The session changed while this was in flight (this tab or another one): the answer was
      // sent with whatever cookie was current, so it is not stored under this identity.
      if (currentRevision() !== identity.revision) throw new CancelledError({ revert: true });
      return data;
    },
    placeholderData: (previous, previousQuery) =>
      isSameScope(identity, previousQuery?.queryKey) ? previous : undefined,
  });
}
