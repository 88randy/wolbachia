import { useTranslation } from "react-i18next";
import { Card } from "../src/ui/Card";
import { ErrorState } from "../src/ui/ErrorState";
import { MiniBarChart } from "../src/analytics/MiniBarChart";
import { PreviewWidgetMetrics } from "./PreviewWidgetMetrics";
import { PreviewPeriod } from "./PreviewPeriod";
interface PreviewFieldWidgetProps {
  hasFailure: boolean;
  onRetry: () => void;
}
export function PreviewFieldWidget({ hasFailure, onRetry }: PreviewFieldWidgetProps) {
  const { t } = useTranslation();
  return (
    <Card muted title={t("refresh.preview.widgetField")} period={<PreviewPeriod />}>
      {hasFailure ? (
        <ErrorState
          message={t("refresh.preview.failed")}
          code="demo_widget_unavailable"
          requestId="preview-field-202"
          onRetry={onRetry}
        />
      ) : (
        <>
          <PreviewWidgetMetrics kind="field" />
          <MiniBarChart
            title={t("refresh.preview.visits")}
            labels={["30", "31", "01", "02", "03", "04", "05"]}
            values={[152, 179, 141, 196, 182, 209, 225]}
          />
        </>
      )}
    </Card>
  );
}
