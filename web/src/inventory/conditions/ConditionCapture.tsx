import type { Schemas } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { useCan } from "../../session/use-can";
import { useOnline } from "../../settings/organization/use-online";
import { ConditionCaptureForm } from "./ConditionCaptureForm";
import type { useConditionCapture } from "./use-condition-capture";
interface Props {
  capture: ReturnType<typeof useConditionCapture>;
  status: Schemas["ConditionStatus"];
  ready: boolean;
}
export function ConditionCapture(props: Props) {
  const { t } = useTranslation();
  const can = useCan();
  const online = useOnline();
  if (!can("condition.create") || !props.status.can_create_condition) return null;
  return (
    <Card title={t("conditions.action.capture")}>
      <ConditionCaptureForm {...props} online={online} />
    </Card>
  );
}
