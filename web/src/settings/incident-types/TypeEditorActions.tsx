import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { TypeHistory } from "./TypeHistory";
import { isConfiguredType } from "./incident-types-query";
import type { EditorFormProps } from "./TypeEditorForm";
import styles from "./incident-types.module.css";
export function TypeEditorActions({ controller, scope, item, canSave, onClose }: EditorFormProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.actions}>
      <Button variant="secondary" onClick={onClose}>
        {t("common.actions.close")}
      </Button>
      <Button type="submit" loading={controller.writer.isBusy} aria-disabled={!canSave}>
        {t("incidentTypes.form.save")}
      </Button>
      {isConfiguredType(item) && <TypeHistory scope={scope} item={item} />}
    </div>
  );
}
