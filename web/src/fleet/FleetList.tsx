import { useTranslation } from "react-i18next";
import { ListPage } from "../components/templates/ListPage";
import { useCan } from "../session/use-can";
import { Button } from "../ui/Button";
import { InlineNotice } from "../ui/InlineNotice";
import { CreateMotorcycleDialog } from "./CreateMotorcycleDialog";
import { FleetTable } from "./FleetTable";
import { useListDialog } from "./use-list-dialog";
import { MOTORCYCLE_MANAGE } from "./permissions";

/** W20: the motorcycle list. */
export function FleetList() {
  const { t } = useTranslation();
  const can = useCan();
  const dialog = useListDialog();
  const canManage = can(MOTORCYCLE_MANAGE);
  return (
    <ListPage
      title={t("fleet.page.title")}
      actions={canManage && <Button onClick={dialog.open}>{t("fleet.create.title")}</Button>}
      notices={
        dialog.isSaved && <InlineNotice tone="success">{t("fleet.action.saved")}</InlineNotice>
      }
    >
      <FleetTable />
      {dialog.isAdding && canManage && (
        <CreateMotorcycleDialog onClose={dialog.close} onCreated={dialog.created} />
      )}
    </ListPage>
  );
}
