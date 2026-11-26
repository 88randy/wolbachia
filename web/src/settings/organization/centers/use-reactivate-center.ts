import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../ui/toast-context";
import { errorKeyOf } from "./centers-api";
import { useCentersScope } from "./use-centers-scope";

/** Reactivate an inactive center; every center query (switcher, pickers) refreshes. */
export function useReactivateCenter() {
  const { t } = useTranslation();
  const scope = useCentersScope();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await scope.client.POST("/api/v1/centers/{id}/reactivate/", { params: { path: { id } } }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      showToast({ message: t("centersAdmin.detail.reactivated"), tone: "success" });
    },
    onError: (caught) => {
      showToast({ message: t(errorKeyOf(caught)), tone: "critical" });
    },
  });
}
