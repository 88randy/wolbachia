import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { TypeFormStatus } from "./TypeFormStatus";
import { TypeEditorFields } from "./TypeEditorFields";
import { TypeEditorActions } from "./TypeEditorActions";
import { TypeAvailabilityNotice } from "./TypeAvailabilityNotice";
import type { TypeEditorProps } from "./type-editor-props";
import type { TypeFormController } from "./use-type-form";
import styles from "./incident-types.module.css";
export interface EditorFormProps extends TypeEditorProps {
  controller: TypeFormController;
  canSave: boolean;
  isOwnerBlocked: boolean;
  isOnline: boolean;
}
export function TypeEditorForm(props: EditorFormProps) {
  const { t } = useTranslation();
  const availability = {
    isOnline: props.isOnline,
    isReady: props.isReady,
    isSettled: props.scope.identity.isSettled,
  };
  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.canSave) void props.controller.save();
  }
  return (
    <form aria-label={t("incidentTypes.form.label")} className={styles.form} onSubmit={submit}>
      <TypeAvailabilityNotice {...availability} />
      <TypeFormStatus controller={props.controller} isBlocked={props.isOwnerBlocked} />
      <TypeEditorFields {...props} />
      <InlineNotice>{t("incidentTypes.form.retainedRules")}</InlineNotice>
      <InlineNotice>{t("incidentTypes.form.reminder")}</InlineNotice>
      <TypeEditorActions {...props} />
    </form>
  );
}
