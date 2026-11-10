import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { useOnlineStatus } from "../../shell/use-online-status";
import { useTypeForm } from "./use-type-form";
import { TypeEditorForm } from "./TypeEditorForm";
import type { TypeEditorProps } from "./type-editor-props";
export function TypeEditor(props: TypeEditorProps) {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const controller = useTypeForm({
    scope: props.scope,
    item: props.item,
    review: props.onReview,
    onSaved: props.onSaved,
  });
  const isOwnerBlocked = !Object.values(controller.eligibility).every(Boolean);
  const canSave =
    props.isReady &&
    isOnline &&
    props.scope.identity.isSettled &&
    !isOwnerBlocked &&
    !controller.writer.needsReview;
  return (
    <Card title={props.item?.label ?? t("incidentTypes.page.create")}>
      <TypeEditorForm
        {...props}
        controller={controller}
        canSave={canSave}
        isOwnerBlocked={isOwnerBlocked}
        isOnline={isOnline}
      />
    </Card>
  );
}
