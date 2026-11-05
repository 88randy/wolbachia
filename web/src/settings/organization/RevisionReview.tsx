import { useTranslation } from "react-i18next";
import type { ScopeEditor } from "./use-scope-editor";
import { ScopeComparison } from "./ScopeComparison";
export function RevisionReview({ editor }: { editor: ScopeEditor }) {
  const { t } = useTranslation();
  return (
    <div>
      <p>
        {t("orgAdmin.revision.current")}
        {editor.current?.revision ?? editor.revision}
      </p>
      {editor.writer.error && <p role="alert">{t(editor.writer.error)}</p>}
      {editor.writer.error && (
        <button
          type="button"
          disabled={editor.writer.isBusy}
          onClick={() => {
            void editor.refresh();
          }}
        >
          {t("orgAdmin.revision.refresh")}
        </button>
      )}
      <ScopeComparison editor={editor} />
    </div>
  );
}
