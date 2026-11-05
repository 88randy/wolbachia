import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import type { ScopeEditor } from "./use-scope-editor";
import styles from "./organization.module.css";
interface Props {
  codes: string[];
  editor: ScopeEditor;
}
export function PermissionFields({ codes, editor }: Props) {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <fieldset className={styles.fieldset}>
      <legend>{t("orgAdmin.roles.permissions")}</legend>
      {codes.map((permission) => (
        <label key={permission} className={styles.row}>
          <input
            type="checkbox"
            checked={editor.permissions.includes(permission)}
            disabled={
              !editor.permissions.includes(permission) && !me.permissions.includes(permission)
            }
            onChange={() => {
              editor.toggle(permission);
            }}
          />
          {permission}
        </label>
      ))}
    </fieldset>
  );
}
