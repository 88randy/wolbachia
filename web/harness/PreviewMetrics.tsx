import { useTranslation } from "react-i18next";
import { useLanguage } from "../src/i18n/use-language";
import { KpiStrip } from "../src/analytics/KpiStrip";
import { KpiCell } from "../src/analytics/KpiCell";
export function PreviewMetrics() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const number = new Intl.NumberFormat(language);
  return (
    <KpiStrip>
      <KpiCell
        label={t("refresh.preview.readings")}
        value={number.format(1284)}
        delta={6.2}
        href="/operations"
      />
      <KpiCell label={t("refresh.preview.eggs")} value="38%" delta={-2.1} href="/operations" />
      <KpiCell
        label={t("refresh.preview.bags")}
        value={number.format(46)}
        delta={4}
        deltaUnit=""
        href="/lab"
      />
      <KpiCell
        label={t("refresh.preview.incidents")}
        value={number.format(12)}
        delta={-3}
        deltaUnit=""
        href="/incidents"
      />
      <KpiCell
        label={t("refresh.preview.releases")}
        value={number.format(18500)}
        delta={9}
        href="/releases"
      />
    </KpiStrip>
  );
}
