import type { QueryClient } from "@tanstack/react-query";
import type { AdminContext } from "./use-w-03";
import type { useOrganizationDraft } from "./use-organization-draft";
import { useAdminWrite } from "./use-admin-write";
import { requestLogoUpload, requestOrganizationChange } from "./organization-requests";
import { refreshAdministration } from "./refresh-administration";
import { publishOrganization } from "./organization-cache";
/** One guarded manual attempt publishes the server revision before accepting its draft. */
export function useOrganizationWrites(
  context: AdminContext & { queryClient: QueryClient },
  draft: ReturnType<typeof useOrganizationDraft>,
) {
  const writer = useAdminWrite();
  const request = { client: context.client, settings: draft.settings };
  async function save() {
    await writer.run(async (guard) => {
      const { result } = await requestOrganizationChange({ ...request, guard });
      if (!(await publishOrganization(context, result, guard))) return;
      draft.accept(result);
      await refreshAdministration({ ...context, guard });
    });
  }
  async function upload(file: File) {
    await writer.run(async (guard) => {
      const result = await requestLogoUpload({ ...request, guard }, file);
      if (result && (await publishOrganization(context, result, guard))) draft.acceptLogo(result);
    });
  }
  return { writer, save, upload };
}
