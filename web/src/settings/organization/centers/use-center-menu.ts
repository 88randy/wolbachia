import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { OverflowAction } from "../../../components/templates/OverflowMenu";
import { useCan } from "../../../session/use-can";
import { CENTER_DEACTIVATE, CENTER_UPDATE } from "./centers-api";
import type { CenterRow } from "./centers-api";
import { useReactivateCenter } from "./use-reactivate-center";

/** Desactivar (opens the guided close flow) or Reactivar, for one center. */
function useLifecycleAction() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reactivate = useReactivateCenter();
  return (center: CenterRow): OverflowAction =>
    center.is_active
      ? {
          id: "deactivate",
          label: t("centersAdmin.action.deactivate"),
          destructive: true,
          onSelect: () => {
            const params = { code: center.code };
            void navigate({ to: "/settings/organization/centers/$code/close", params });
          },
        }
      : {
          id: "reactivate",
          label: t("centersAdmin.action.reactivate"),
          disabled: reactivate.isPending,
          onSelect: () => {
            reactivate.mutate(center.id);
          },
        };
}

/** "⋯" actions of one center: Editar, then Desactivar or Reactivar. Hidden without permission. */
export function useCenterMenu(onEdit: (center: CenterRow) => void) {
  const { t } = useTranslation();
  const can = useCan();
  const lifecycle = useLifecycleAction();
  return (center: CenterRow): OverflowAction[] => {
    const edit: OverflowAction = {
      id: "edit",
      label: t("centersAdmin.action.edit"),
      onSelect: () => {
        onEdit(center);
      },
    };
    return [
      ...(can(CENTER_UPDATE) ? [edit] : []),
      ...(can(CENTER_DEACTIVATE) ? [lifecycle(center)] : []),
    ];
  };
}
