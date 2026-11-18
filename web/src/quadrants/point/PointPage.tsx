import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import { NotFoundState } from "../../states/NotFoundState";
import { PendingState } from "../../states/PendingState";
import { ErrorState } from "../../ui/ErrorState";
import { useGeographyScope } from "../geography/use-w-15";
import type { GeographyScope } from "../geography/use-w-15";
import { PointRecord } from "./PointRecord";
import { usePointPage } from "./use-point-page";

function PointScreen({
  scope,
  code,
  pointCode,
}: {
  scope: GeographyScope;
  code: string;
  pointCode: string;
}) {
  const { t } = useTranslation();
  const data = usePointPage(scope, code, pointCode);
  useDocumentTitle(pointCode);
  const failed = data.quadrant.error ?? data.point.error;
  if (failed)
    return (
      <ErrorState
        message={t("pointPage.error")}
        onRetry={() => {
          void data.quadrant.refetch();
          void data.point.refetch();
        }}
      />
    );
  if (data.quadrant.isPending || (data.quadrant.data && data.point.isPending))
    return <PendingState />;
  // The same screen for "does not exist" and "you may not see it": no hint about foreign records.
  if (!data.quadrant.data || !data.point.data) return <NotFoundState />;
  return <PointRecord data={data} quadrantCode={code} />;
}

/** `/quadrants/<quadrant code>/points/<point code>`: one sampling point, read-only. */
export function PointPage() {
  const { code, pointCode } = useParams({ strict: false });
  const scope = useGeographyScope();
  if (!code || !pointCode || !scope.canRead) return <NotFoundState />;
  return (
    <PointScreen
      key={`${scope.context}|${code}|${pointCode}`}
      scope={scope}
      code={code}
      pointCode={pointCode}
    />
  );
}
