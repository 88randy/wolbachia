import { unwrap } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
import type { Organization } from "./use-w-03";
import { useOrganizationDraft } from "./use-organization-draft";
import { useOrganizationWrites } from "./use-organization-writes";
/** Drafts survive refusals. Explicit comparison review adopts a newer expected revision. */
export function useOrganizationForm(initial: Organization) {
  const draft = useOrganizationDraft(initial);
  const client = useApiClient();
  const context = { client, queryClient: useQueryClient(), identity: useSessionIdentity() };
  const writes = useOrganizationWrites(context, draft);
  async function refresh() {
    const result = await writes.writer.run((guard) =>
      client.GET("/api/v1/organization/", { signal: guard.signal }).then(unwrap),
    );
    if (result) draft.setComparison(result);
  }
  const review = () => {
    draft.review(writes.writer.reviewed);
  };
  return { ...draft, ...writes, refresh, review };
}
export type OrganizationFormController = ReturnType<typeof useOrganizationForm>;
