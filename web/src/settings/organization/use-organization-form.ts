import { unwrap } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useAdminWrite } from "./use-admin-write";
import type { Organization } from "./use-w-03";
import { useOrganizationDraft } from "./use-organization-draft";
import { requestLogoUpload, requestOrganizationChange } from "./organization-requests";
import { refreshAdministration } from "./refresh-administration";
/** Drafts survive refusals. Explicit comparison review adopts a newer expected revision. */
export function useOrganizationForm(initial: Organization) {
  const draft = useOrganizationDraft(initial);
  const client = useApiClient();
  const queryClient = useQueryClient();
  const writer = useAdminWrite();
  async function save() {
    await writer.run(async (guard) => {
      const reply = await requestOrganizationChange({ client, guard, settings: draft.settings });
      if (guard.isStale()) return;
      draft.accept(reply.result);
      await refreshAdministration({ client, queryClient, guard });
    });
  }
  async function upload(file: File) {
    const result = await writer.run((guard) =>
      requestLogoUpload({ client, guard, settings: draft.settings }, file),
    );
    if (result) draft.acceptLogo(result);
  }
  async function refresh() {
    const result = await writer.run((guard) =>
      client.GET("/api/v1/organization/", { signal: guard.signal }).then(unwrap),
    );
    if (result) draft.setComparison(result);
  }
  const review = () => {
    draft.review(writer.reviewed);
  };
  return { ...draft, save, upload, writer, refresh, review };
}
export type OrganizationFormController = ReturnType<typeof useOrganizationForm>;
