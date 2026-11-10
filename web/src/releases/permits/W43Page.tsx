import { useTranslation } from "react-i18next";
import { ListPage } from "../../components/templates/ListPage";
import { Button } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { PermitTypeDialog } from "./PermitTypeDialog";
import { PermitTypesTable } from "./PermitTypesTable";
import { useOpenState } from "./use-open-state";
import { usePermitTypesScreen } from "./use-permit-types-screen";

/**
 * W43, permit types. The empty state explains what a type is for and offers the first one.
 * Creating needs `permit.manage` with whole-organization scope; otherwise the button is disabled
 * and its reason is on the button. A type is immutable: no edit, no delete.
 */
export function W43Page() {
  const { t } = useTranslation();
  const screen = usePermitTypesScreen();
  const dialog = useOpenState();
  const label = screen.isFirstUse ? "permits.types.createFirst" : "permits.types.create";
  const create = (
    <Button
      disabled={!screen.canCreate}
      title={screen.canCreate ? undefined : t("permits.types.noScope")}
      onClick={dialog.open}
    >
      {t(label)}
    </Button>
  );
  return (
    <ListPage title={t("permits.types.title")}>
      {screen.isFirstUse ? (
        <EmptyState kind="noData" message={t("permits.types.emptyHint")} action={create} />
      ) : (
        <PermitTypesTable screen={screen} actions={create} />
      )}
      {dialog.isOpen && <PermitTypeDialog onClose={dialog.close} onCreated={dialog.close} />}
    </ListPage>
  );
}
