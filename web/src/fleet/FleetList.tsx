import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import { classNames } from "../styles/class-names";
import page from "../styles/page.module.css";
import { CreateMotorcycleDialog } from "./CreateMotorcycleDialog";
import { FleetTable } from "./FleetTable";
import { FleetListHeader } from "./FleetListHeader";
import { useListDialog } from "./use-list-dialog";
import { MOTORCYCLE_MANAGE } from "./permissions";
import styles from "./fleet.module.css";
export function FleetList() {
  const { t } = useTranslation();
  useDocumentTitle(t("fleet.page.title"));
  const can = useCan();
  const dialog = useListDialog();
  return (
    <section className={classNames(page.page, styles.content)}>
      <FleetListHeader onAdd={dialog.open} />
      <p className={styles.hint}>{t("fleet.page.gaps")}</p>
      <p role="status">{dialog.isSaved ? t("fleet.action.saved") : ""}</p>
      <FleetTable />
      {dialog.isAdding && can(MOTORCYCLE_MANAGE) && (
        <CreateMotorcycleDialog onClose={dialog.close} onCreated={dialog.created} />
      )}
    </section>
  );
}
