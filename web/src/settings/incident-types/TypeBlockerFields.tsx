import { useTranslation } from "react-i18next";
import { Switch } from "../../ui/Switch";
import { TypeBlockerChoices } from "./TypeBlockerChoices";
import { TypeRetainedBlockers } from "./TypeRetainedBlockers";
import { hasReadOnlyBlockers } from "./type-blockers";
import type { TypeFieldProps } from "./type-editor-types";
import styles from "./incident-types.module.css";
export function TypeBlockerFields(props: TypeFieldProps) {
  const { t } = useTranslation();
  const toggle = (isActive: boolean) => {
    props.change("is_active", isActive);
  };
  return (
    <>
      {hasReadOnlyBlockers(props.item) ? (
        <TypeRetainedBlockers item={props.item} />
      ) : (
        <TypeBlockerChoices {...props} />
      )}
      <Switch
        label={t("incidentTypes.field.active")}
        isOn={props.draft.is_active ?? true}
        disabled={props.item?.is_other}
        onChange={toggle}
      />
      {props.item?.is_other && (
        <p className={styles.hint}>{t("incidentTypes.form.protectedOther")}</p>
      )}
    </>
  );
}
