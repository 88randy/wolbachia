import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import type { Organization } from "./use-w-03";
import { LogoMark } from "./LogoMark";
export function LabelPreview({ settings }: { settings: Organization }) {
  const { t } = useTranslation();
  return (
    <Card title={t("orgAdmin.brand.preview")}>
      <div className="flex flex-col gap-3 rounded-xl border-2 border-ink p-4 [overflow-wrap:anywhere]">
        <LogoMark name={settings.name} url={settings.logo_url} revision={settings.revision} />
        <strong className="text-base text-ink">{settings.name}</strong>
        <p className="m-0 rounded-lg bg-critical-bg px-3 py-2 text-sm font-semibold text-critical-fg">
          {t("orgAdmin.brand.inUse")}
        </p>
        {settings.label_phone && <span className="text-sm text-ink">{settings.label_phone}</span>}
      </div>
      <p className="m-0 pt-3 text-xs text-ink-2">{t("orgAdmin.brand.hint")}</p>
    </Card>
  );
}
