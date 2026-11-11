import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../../../session/use-can";
import { Button } from "../../../ui/Button";
import { buttonVariants } from "../../../ui/button-variants";
import { CENTER_DEACTIVATE, CENTER_UPDATE } from "./centers-api";
import type { CenterRow } from "./centers-api";
import { CenterFormDialog } from "./CenterFormDialog";
import { useReactivateCenter } from "./use-reactivate-center";

/** Desactivar centro (opens the guided close flow) or Reactivar. */
function LifecycleAction({ center }: { center: CenterRow }) {
  const { t } = useTranslation();
  const reactivate = useReactivateCenter();
  if (center.is_active)
    return (
      <Link
        to="/settings/organization/centers/$code/close"
        params={{ code: center.code }}
        className={buttonVariants({ variant: "destructive" })}
      >
        {t("centersAdmin.action.deactivate")}
      </Link>
    );
  return (
    <Button
      loading={reactivate.isPending}
      onClick={() => {
        reactivate.mutate(center.id);
      }}
    >
      {t("centersAdmin.action.reactivate")}
    </Button>
  );
}

/** Editar (secondary) and the lifecycle action; each one hidden without its permission. */
export function CenterHeaderActions({ center }: { center: CenterRow }) {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {can(CENTER_UPDATE) && (
        <CenterFormDialog
          center={center}
          trigger={<Button variant="secondary">{t("centersAdmin.action.edit")}</Button>}
        />
      )}
      {can(CENTER_DEACTIVATE) && <LifecycleAction center={center} />}
    </div>
  );
}
