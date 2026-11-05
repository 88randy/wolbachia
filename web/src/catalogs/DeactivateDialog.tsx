import { useTranslation } from "react-i18next";
import { CatalogDialogFrame } from "./CatalogDialogFrame";
import { CatalogDialogActions } from "./CatalogDialogActions";
import { displayLabel } from "./catalog-domain";
import { changeAvailability } from "./use-catalog-editor";
import type { CatalogEditor } from "./use-catalog-editor";
import type { CatalogItem } from "./catalogs-query";
/** Configuration is deactivated with plain confirmation, never voided with a reason. */
export function DeactivateDialog({ editor, item }: { editor: CatalogEditor; item: CatalogItem }) {
  const { t } = useTranslation();
  const isBusy = editor.write.isBusy;
  const cancel = () => {
    editor.setDialog(null);
  };
  const title = t("catalogs.confirm.title", { name: displayLabel(item, editor.language).label });
  return (
    <CatalogDialogFrame title={title} isBusy={isBusy} onCancel={cancel}>
      <p>{t("catalogs.confirm.hint")}</p>
      {editor.error && <p role="alert">{t(editor.error)}</p>}
      <CatalogDialogActions
        isBusy={isBusy}
        onCancel={cancel}
        confirmKey="catalogs.actions.deactivate"
        onConfirm={() => {
          void changeAvailability(editor, item);
        }}
      />
    </CatalogDialogFrame>
  );
}
