import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import type { ScopeEditor } from "./use-scope-editor";
import { PERMISSION_GROUP_ORDER, permissionGroup, permissionLabel } from "./permission-labels";
interface Props {
  codes: string[];
  editor: ScopeEditor;
}
/** Permissions as a matrix grouped by module, with human labels (never codes) and checkboxes. */
export function PermissionFields({ codes, editor }: Props) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const exists = (key: string) => i18n.exists(key);
  const groups = PERMISSION_GROUP_ORDER.map((group) => ({
    group,
    codes: codes
      .filter((code) => permissionGroup(code) === group)
      .map((code) => ({ code, label: permissionLabel(code, t, exists) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  })).filter((entry) => entry.codes.length > 0);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-sm font-semibold">{t("perm.matrix.title")}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map(({ group, codes: entries }) => (
          <fieldset key={group} className="rounded-xl border border-line bg-surface p-4">
            <legend className="px-1 text-xs font-bold tracking-wide text-ink-2 uppercase">
              {t(`perm.group.${group}` as MessageKey)}
            </legend>
            {entries.map(({ code, label }) => {
              const isOn = editor.permissions.includes(code);
              const isGrantable = isOn || me.permissions.includes(code);
              return (
                <label key={code} title={isGrantable ? undefined : t("perm.matrix.notGrantable")}>
                  <input
                    type="checkbox"
                    checked={isOn}
                    disabled={!isGrantable}
                    onChange={() => {
                      editor.toggle(code);
                    }}
                  />
                  <span className="text-[13px]">{label}</span>
                </label>
              );
            })}
          </fieldset>
        ))}
      </div>
    </div>
  );
}
