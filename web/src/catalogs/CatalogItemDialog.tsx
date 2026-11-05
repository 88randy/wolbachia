import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import styles from "./catalogs.module.css";
import { CatalogDialogFrame } from "./CatalogDialogFrame";
import { CatalogDialogActions } from "./CatalogDialogActions";
import { CatalogFormFields } from "./CatalogFormFields";
import { useCatalogForm } from "./use-catalog-form";
import type { CatalogEditor } from "./use-catalog-editor";
import type { CatalogItem } from "./catalogs-query";
/** Mount a create/edit form; a stale answer leaves its draft untouched. */
export function CatalogItemDialog({ editor, item }: { editor: CatalogEditor; item?: CatalogItem }) {
  const { t } = useTranslation();
  const state = useCatalogForm(editor, item);
  const isBusy = editor.write.isBusy;
  const cancel = () => {
    editor.setDialog(null);
  };
  return (
    <CatalogDialogFrame
      title={t(item ? "catalogs.form.edit" : "catalogs.form.create")}
      isBusy={isBusy}
      onCancel={cancel}
    >
      <form className={styles.form} onSubmit={state.onSubmit} noValidate>
        <CatalogFormFields form={state.form} isCreate={item === undefined} isBusy={isBusy} />
        {state.error && (
          <FormAlert
            id="catalog-form-error"
            title={t("errors.api.validation")}
            text={t(state.error)}
          />
        )}
        <CatalogDialogActions isBusy={isBusy} onCancel={cancel} confirmKey="catalogs.form.save" />
      </form>
    </CatalogDialogFrame>
  );
}
