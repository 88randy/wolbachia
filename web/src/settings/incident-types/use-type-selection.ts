import { useTranslation } from "react-i18next";
import { useToast } from "../../ui/toast-context";
import type { IncidentType } from "./incident-types-query";
import type { useW06 } from "./use-w-06";
import { useAcceptedType } from "./use-accepted-type";
export function useTypeSelection(controller: ReturnType<typeof useW06>) {
  const { t } = useTranslation();
  const toast = useToast();
  const code = controller.editor || controller.configurationCode;
  const query = controller.configurationCode ? controller.unconfigured : controller.selected;
  const item = useAcceptedType(code, query);
  async function review() {
    const refreshed = await controller.selected.refetch();
    return refreshed.error
      ? undefined
      : refreshed.data?.results.find((candidate) => candidate.code === code);
  }
  function saved(result: IncidentType) {
    toast.showToast({ message: t("incidentTypes.form.saved"), tone: "success" });
    controller.edit(result.code);
  }
  function retry() {
    void query.refetch();
  }
  function retryList() {
    void controller.query.refetch();
  }
  return { code, query, item, review, saved, retry, retryList };
}
