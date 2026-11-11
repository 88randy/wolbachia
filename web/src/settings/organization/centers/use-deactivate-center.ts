import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { unwrap } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../ui/toast-context";
import type { CenterRow } from "./centers-api";
import { useCentersScope } from "./use-centers-scope";

/** Deactivate with a reason; on success every center query refreshes and the record opens. */
export function useDeactivateCenter(center: CenterRow) {
  const { t } = useTranslation();
  const scope = useCentersScope();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: async (reason: string) =>
      unwrap(
        await scope.client.POST("/api/v1/centers/{id}/deactivate/", {
          params: { path: { id: center.id } },
          body: { reason },
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      showToast({ message: t("centersAdmin.close.done"), tone: "success" });
      void navigate({ to: "/settings/organization/centers/$code", params: { code: center.code } });
    },
    onError: () => {
      // A refusal lists its blockers; the checklist refreshes to match the server.
      void queryClient.invalidateQueries({ queryKey: ["centers"] });
    },
  });
}
