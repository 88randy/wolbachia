import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { requestCopyProfile } from "../../people-admin/people-requests";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { useAdminWrite } from "./use-admin-write";
import type { Profile } from "./use-w-03";

/** POST /roles/: a new custom profile that starts as a copy of `source`. */
export function useCopyProfile(source: Profile, onCopied: () => void) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const writer = useAdminWrite();
  const [labelEs, setLabelEs] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const isReady = labelEs.trim() !== "" && labelEn.trim() !== "";
  async function submit() {
    if (!isReady) return;
    const created = await writer.run((guard) =>
      requestCopyProfile(
        client,
        { copy_from: source.id, label_es: labelEs.trim(), label_en: labelEn.trim() },
        guard.signal,
      ),
    );
    if (!created) return;
    await Promise.all([
      invalidateOrgScoped(queryClient, "administration"),
      invalidateOrgScoped(queryClient, "users"),
    ]);
    onCopied();
  }
  return { writer, labelEs, setLabelEs, labelEn, setLabelEn, isReady, submit };
}
