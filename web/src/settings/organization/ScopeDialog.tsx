import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useModalDialog } from "../../session/use-modal-dialog";
import { useScopeEditor } from "./use-scope-editor";
import type { EditTarget } from "./use-scope-editor";
import { ScopeEditForm } from "./ScopeEditForm";
import dialog from "../../void/void-dialog.module.css";
interface Props {
  target: EditTarget;
  codes: string[];
  onClose: () => void;
  onSaved: () => void;
  returnFocusId?: string | undefined;
}
export function ScopeDialog({ target, codes, onClose, onSaved, returnFocusId }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const ref = useModalDialog(
    "input:not(:disabled), select:not(:disabled), button:not(:disabled)",
    returnFocusId,
  );
  const editor = useScopeEditor(target, onSaved);
  return (
    <dialog
      ref={ref}
      className={dialog.dialog}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        if (!editor.writer.isBusy) onClose();
      }}
    >
      <h2 id={id}>{t(target.kind === "role" ? "orgAdmin.roles.edit" : "orgAdmin.members.edit")}</h2>
      <ScopeEditForm editor={editor} target={target} codes={codes} onClose={onClose} />
    </dialog>
  );
}
