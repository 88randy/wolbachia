import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { orgScopedQueryOptions } from "../../session/org-scoped-query";
import { useSessionIdentity } from "../../session/use-session-identity";
import type { Profile } from "./use-w-03";

/** Active members of a profile: the count links to the memberships view filtered by it. */
export function ProfileMembersCell({ profile, label }: { profile: Profile; label: string }) {
  const { t } = useTranslation();
  const client = useApiClient();
  const query = useQuery(
    orgScopedQueryOptions(useSessionIdentity(), {
      key: ["administration", "profile-members", profile.id],
      queryFn: async ({ signal }) =>
        unwrap(
          await client.GET("/api/v1/memberships/", {
            params: { query: { profiles: profile.id, is_active: true, page_size: 1 } },
            signal,
          }),
        ).count,
    }),
  );
  if (query.data === undefined) return <span aria-busy={query.isPending}>—</span>;
  return (
    <Link
      to="/settings/roles"
      search={{ view: "memberships", profiles: profile.id }}
      aria-label={t("users.roles.membersLink", { name: label })}
      className="tabular-nums text-action hover:underline"
    >
      {t("users.roles.membersCount", { count: query.data })}
    </Link>
  );
}
