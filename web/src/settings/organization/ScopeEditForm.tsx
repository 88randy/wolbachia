import { AdminSaveButton } from "./AdminSaveButton";
import { DialogFooter } from "../../ui/DialogFooter";
import { Button } from "../../ui/Button";
import { useTranslation } from "react-i18next";
import { useOnline } from "./use-online";
import { ScopeFields } from "./ScopeFields";
import { MembershipProfileFields } from "./MembershipProfileFields";
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
  const isBlocked =
    editor.writer.isBusy || editor.writer.needsReview || editor.lookups.hasPending || !isOnline;
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
        {target.kind === "membership" && <MembershipProfileFields editor={editor} />}
        <ScopeFields editor={editor} />
      </fieldset>
      <RevisionReview editor={editor} />
      {editor.lookups.hasPending && <p role="status">{t("orgAdmin.scope.pending")}</p>}
      {!isOnline && <p>{t("orgAdmin.error.offline")}</p>}
      <DialogFooter>
        <Button variant="secondary" disabled={editor.writer.isBusy} onClick={onClose}>
          {t("common.actions.cancel")}
        </Button>
        <AdminSaveButton isBlocked={isBlocked} isBusy={editor.writer.isBusy} />
      </DialogFooter>
    </form>
  );
}
