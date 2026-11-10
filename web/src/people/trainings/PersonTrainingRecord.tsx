import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { InlineNotice } from "../../ui/InlineNotice";
import { CertificateList } from "./CertificateList";
import { CertificateCreate } from "./CertificateCreate";
import { TrainingEligibility } from "./TrainingEligibility";
import type { PersonContext } from "./person-context";
import type { TrainingScope } from "./training-query";
interface Props {
  scope: TrainingScope;
  context: PersonContext;
}
export function PersonTrainingRecord({ scope, context }: Props) {
  const { t } = useTranslation();
  const me = useMe();
  const canRead = me.permissions.includes("training.read");
  const canManage = me.permissions.includes("training.manage");
  const canUpload = me.permissions.includes("field.upload");
  return (
    <>
      {canRead && <CertificateList scope={scope} context={context} />}
      {canRead && context.action && <TrainingEligibility scope={scope} context={context} />}
      {canManage && canUpload && <CertificateCreate scope={scope} context={context} />}
      {canManage && !canUpload && (
        <InlineNotice tone="warning">{t("trainings.person.uploadPermission")}</InlineNotice>
      )}
    </>
  );
}
