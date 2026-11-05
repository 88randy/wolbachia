import { AdminSaveButton } from "./AdminSaveButton";
import { useTranslation } from "react-i18next";
import { useOnline } from "./use-online";
import { ScopeFields } from "./ScopeFields";
import { PermissionFields } from "./PermissionFields";
import { RevisionReview } from "./RevisionReview";
import type { ScopeEditor, EditTarget } from "./use-scope-editor";
import styles from "./organization.module.css";
interface Props {
  editor: ScopeEditor;
  target: EditTarget;
  codes: string[];
  onClose: () => void;
}
export function ScopeEditForm({ editor, target, codes, onClose }: Props) {
  const { t } = useTranslation();
  const isOnline = useOnline();
  const isBlocked = editor.writer.isBusy || editor.writer.needsReview || !isOnline;
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isBlocked) void editor.save();
      }}
    >
      <fieldset disabled={editor.writer.isBusy} className={styles.fields}>
        {target.kind === "role" && <PermissionFields codes={codes} editor={editor} />}
        <ScopeFields scope={editor.scope} onChange={editor.setScope} />
      </fieldset>
      <RevisionReview editor={editor} />
      {!isOnline && <p>{t("orgAdmin.error.offline")}</p>}
      <div className={styles.row}>
        <AdminSaveButton isBlocked={isBlocked} isBusy={editor.writer.isBusy} />
        <button type="button" disabled={editor.writer.isBusy} onClick={onClose}>
          {t("common.actions.cancel")}
        </button>
      </div>
    </form>
  );
}
