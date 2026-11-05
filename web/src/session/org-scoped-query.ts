import { CancelledError, queryOptions } from "@tanstack/react-query";
import type { QueryClient, QueryFunction, QueryKey } from "@tanstack/react-query";
import type { Me } from "./me";
import { currentRevision } from "./session-revision";

/** Elements of the scope prefix: `["org", userId, organizationSlug]`. */
const SCOPE_LENGTH = 3;

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

/** `["org", userId, organizationSlug]`: the prefix of every org-scoped key. */
function scopeOf(identity: SessionIdentity): readonly [string, string, string] {
  return [ORG_SCOPE, identity.userId, identity.organizationSlug];
}

/** The previous query was loaded under this very identity AND session revision. */
interface PreviousQuery {
  queryKey: QueryKey;
  meta?: Readonly<Record<string, unknown>> | undefined;
}

function isSameScope(identity: SessionIdentity, previous: PreviousQuery | undefined): boolean {
  const key: QueryKey = previous?.queryKey ?? [];
  const isSameKey = scopeOf(identity).every((part, index) => key[index] === part);
  return isSameKey && previous?.meta?.["revision"] === identity.revision;
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
 * - the key starts with the user and the organization, so an answer asked for under another
 *   identity can never be read for this one. The revision is NOT in the key: a re-authentication
 *   of the same user must not unmount the screens (drafts survive, #28);
 * - an answer that arrives after the session revision changed (a login, a sign-out, another
 *   identity in `/me/`, or another tab doing any of it) is dropped, and the query waits while the
 *   tab reconciles with `/me/`;
 * - the previous page is kept as placeholder (no flicker while paging) only when it was loaded
 *   under the SAME identity and session revision. `keepPreviousData` alone would keep the old organization's rows on
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
    // Read back by the placeholder rule: data of an earlier revision is never a placeholder.
    meta: { revision: identity.revision },
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
      isSameScope(identity, previousQuery) ? previous : undefined,
  });
}

/** Marks stale every org-scoped query of one resource (the first element after the scope). */
export function invalidateOrgScoped(queryClient: QueryClient, resource: string): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === ORG_SCOPE && query.queryKey[SCOPE_LENGTH] === resource,
  });
}
