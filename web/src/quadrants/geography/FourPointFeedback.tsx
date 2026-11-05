import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { GeographyScope } from "./use-w-15";
import type { FourPoints } from "./use-four-points";
import { allPointsOptions } from "./geography-query";
import { PointReconciliation } from "./PointReconciliation";
import { WriteNotice } from "./WriteNotice";
import { SpacingWarnings } from "./SpacingWarnings";
interface Props {
  scope: GeographyScope;
  block: Schemas["Block"];
  form: FourPoints;
}
export function FourPointFeedback({ scope, block, form }: Props) {
  const { t } = useTranslation();
  const existing = useQuery(allPointsOptions(scope, block.quadrant));
  return (
    <>
      {form.created.length > 0 && (
        <p role="status">
          {t("geography.points.partial")} {form.created.map((point) => point.code).join(", ")}
        </p>
      )}
      <WriteNotice outcome={form.write.outcome} />
      <PointReconciliation form={form} />
      <SpacingWarnings
        warnings={form.warnings}
        points={[...(existing.data ?? []), ...form.created]}
      />
    </>
  );
}
