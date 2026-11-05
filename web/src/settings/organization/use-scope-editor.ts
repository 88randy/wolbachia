import { useQueryClient } from "@tanstack/react-query";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../../api/ApiClientProvider";
import { refreshAdministration } from "./refresh-administration";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { useAdminWrite } from "./use-admin-write";
import { useScopeDraft } from "./use-scope-draft";
import { useScopeRevision } from "./use-scope-revision";
import { requestScopeChange, requestScopeSnapshot } from "./scope-requests";
import type { Profile, Membership } from "./use-w-03";
export type EditTarget =
  { kind: "role"; record: Profile } | { kind: "membership"; record: Membership };
/** Conflict refresh only updates the comparison; the user must review before another write. */
export function useScopeEditor(target: EditTarget, onSaved: () => void) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const writer = useAdminWrite();
  const draft = useScopeDraft(target);
  const versions = useScopeRevision(target.record.revision, writer.reviewed);
  async function refresh() {
    const result = await writer.run<Profile | Membership>((guard) =>
      requestScopeSnapshot({ client, target, guard }),
    );
    if (result) versions.setCurrent(result);
  }
  async function save() {
    const change = { client, target, ...draft, revision: versions.revision };
    const saved = await writer.run(async (guard) => {
      await requestScopeChange({ ...change, guard });
      await refreshAdministration({ client, queryClient, guard });
      return true;
    });
    if (!saved) return;
    onSaved();
    await invalidateOrgScoped(queryClient, "administration");
  }
  return { writer, ...draft, ...versions, refresh, save };
}
export type ScopeEditor = ReturnType<typeof useScopeEditor>;
export type WorkScope = Schemas["MeScope"];
