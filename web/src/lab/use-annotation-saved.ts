import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useToast } from "../ui/toast-context";

export function useAnnotationSaved() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t } = useTranslation();
  return (outcome: Schemas["LabCountOutcome"]) => {
    showToast({ message: t("lab.count.saved"), tone: "success" });
    void navigate({
      to: "/lab/egg-counts",
      search: outcome.next_bag ? { code: outcome.next_bag.code } : {},
    });
  };
}
