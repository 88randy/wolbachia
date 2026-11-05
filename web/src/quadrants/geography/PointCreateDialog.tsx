import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { GeographyScope } from "./use-w-15";
import { useCreatePoint } from "./use-create-point";
import { PointCreationForm } from "./PointCreationForm";
import { GeographyDialog } from "./GeographyDialog";
interface Props {
  scope: GeographyScope;
  block: Schemas["Block"];
  onClose: () => void;
}
export function PointCreateDialog({ scope, block, onClose }: Props) {
  const { t } = useTranslation();
  const form = useCreatePoint(scope, block);
  const title = t("geography.points.create") + " · " + block.code;
  return (
    <GeographyDialog title={title} onClose={onClose} isBusy={form.write.isBusy}>
      <PointCreationForm form={form} onClose={onClose} />
    </GeographyDialog>
  );
}
