import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { useSessionIdentity } from "../session/use-session-identity";
import { organizationOptions } from "../settings/organization/use-w-03";
import { useLogo } from "../settings/organization/use-logo";

/**
 * The active organization's own logo for the shell, or null (product mark). It reuses the
 * organization settings query, so it needs `organization.read`; without it the query stays off.
 */
export function useOrganizationLogo(): string | null {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const { data } = useQuery(organizationOptions({ client, identity }));
  return useLogo(data?.logo_url ?? null, data?.revision ?? 0);
}
