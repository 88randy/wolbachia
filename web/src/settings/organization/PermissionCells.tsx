import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { Button } from "../../ui/Button";
import { ROLE_UPDATE } from "./permissions";
import { PERMISSION_GROUP_ORDER, permissionGroup } from "./permission-labels";
import { isReadOnlyProfile } from "./use-w-03";
import type { Profile } from "./use-w-03";
interface Props {
  profile: Profile;
  codes: string[];
  onEdit: () => void;
}
/** A profile's grants summarized per module ("Operación 5 de 12"); the matrix opens to edit. */
export function PermissionCells({ profile, codes, onEdit }: Props) {
  const { t } = useTranslation();
  const canEdit = useMe().permissions.includes(ROLE_UPDATE) && !isReadOnlyProfile(profile);
  const summary = PERMISSION_GROUP_ORDER.map((group) => {
    const inGroup = codes.filter((code) => permissionGroup(code) === group);
    const granted = inGroup.filter((code) => profile.permissions.includes(code)).length;
    return { group, granted, total: inGroup.length };
  }).filter((entry) => entry.granted > 0);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {summary.map((entry) => (
        <span
          key={entry.group}
          className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-muted px-2.5 text-xs"
        >
          <span className="font-semibold text-ink">
            {t(`perm.group.${entry.group}` as MessageKey)}
          </span>
          <span className="text-ink-2 tabular-nums">
            {entry.granted}/{entry.total}
          </span>
        </span>
      ))}
      {canEdit ? (
        <Button variant="ghost" size="sm" onClick={onEdit}>
          {t("perm.matrix.edit")}
        </Button>
      ) : (
        <span className="text-xs text-ink-3">{t("orgAdmin.roles.readOnly")}</span>
      )}
    </div>
  );
}
