import { InlineNotice } from "../ui/InlineNotice";
import { useTranslation } from "react-i18next";
import type { CatalogEditor } from "./use-catalog-editor";
import { CatalogAddButton } from "./CatalogAddButton";
import { CatalogEditorDialogs } from "./CatalogEditorDialogs";
import styles from "./catalogs.module.css";

/** Dialogs are scoped to one identity and slug; remounting aborts pending writes. */
export function CatalogEditorControls({
  editor,
  isReady,
}: {
  editor: CatalogEditor;
  isReady: boolean;
}) {
  const { t } = useTranslation();
  const isShowingError = editor.error !== null;
  return (
    <>
      <div className={styles.actions}>
        <CatalogAddButton editor={editor} isReady={isReady} />
      </div>
      {isShowingError && editor.error && (
        <InlineNotice tone="warning">
          <span role="alert">{t(editor.error)}</span>
        </InlineNotice>
      )}
      <p role="status" aria-live="polite" aria-atomic="true" className={styles.announcement}>
        {editor.announcement}
      </p>
      <CatalogEditorDialogs editor={editor} />
    </>
  );
}
