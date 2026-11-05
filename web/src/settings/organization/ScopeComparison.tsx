import { useTranslation } from "react-i18next";
import type { ScopeEditor } from "./use-scope-editor";
export function ScopeComparison({ editor }: { editor: ScopeEditor }) {
  const { t } = useTranslation();
  if (!editor.current) return null;
  const snapshot = {
    scope: editor.current.scope,
    permissions: "permissions" in editor.current ? editor.current.permissions : undefined,
  };
  return (
    <>
      <p>{t("orgAdmin.revision.compare")}</p>
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      <button type="button" onClick={editor.review}>
        {t("orgAdmin.revision.review")}
      </button>
    </>
  );
}
