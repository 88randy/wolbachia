import { unwrap } from "@wolbachia/api-client";
import { Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { InlineNotice } from "../../ui/InlineNotice";
import { Switch } from "../../ui/Switch";
import { useToast } from "../../ui/toast-context";
import type { PortalSettings } from "../reg-queries";
import { useRegAction } from "../use-reg-action";
import { useRegScope } from "../use-reg-list";

export const PORTAL_INDICATORS = [
  "releases_total",
  "quadrants_covered",
  "readings_total",
  "egg_positivity",
  "releases_by_week",
  "coverage",
] as const;

/** Switch of the public portal and the indicators it shows. Aggregates only, always. */
export function PortalSettingsForm({ initial }: { initial: PortalSettings }) {
  const { t } = useTranslation();
  const { client } = useRegScope();
  const { showToast } = useToast();
  const slug = useMe().organization?.slug ?? "";
  const [enabled, setEnabled] = useState(initial.enabled ?? false);
  const [indicators, setIndicators] = useState<readonly string[]>(initial.indicators);
  const address = `${window.location.origin}/portal/${slug}`;
  const action = useRegAction({
    successKey: "regulatory.common.saved",
    run: async (_input: null, signal) =>
      unwrap(
        await client.PUT("/api/v1/portal-settings/update/", {
          body: {
            enabled,
            indicators: PORTAL_INDICATORS.filter((code) => indicators.includes(code)),
          },
          signal,
        }),
      ),
  });
  const needsIndicator = enabled && indicators.length === 0;
  return (
    <div className="flex flex-col gap-5">
      <Card title={t("regulatory.portal.enabled")} headingLevel={2}>
        <div className="flex flex-col gap-4">
          <Switch label={t("regulatory.portal.enabled")} isOn={enabled} onChange={setEnabled} />
          <p className="m-0 text-[13px] text-ink-2">{t("regulatory.portal.enabledHint")}</p>
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="mb-1 p-0 text-sm font-semibold text-ink">
              {t("regulatory.portal.indicators")}
            </legend>
            {PORTAL_INDICATORS.map((code) => (
              <label key={code} className="flex items-center gap-2.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={indicators.includes(code)}
                  onChange={(event) => {
                    setIndicators((current) =>
                      event.target.checked ? [...current, code] : current.filter((item) => item !== code),
                    );
                  }}
                />
                {t(`regulatory.portal.indicator.${code}`)}
              </label>
            ))}
          </fieldset>
          {needsIndicator && (
            <InlineNotice tone="warning">{t("regulatory.portal.needIndicator")}</InlineNotice>
          )}
          {action.hasFailed && (
            <InlineNotice tone="critical">{t("regulatory.common.failed")}</InlineNotice>
          )}
          <div>
            <Button
              loading={action.isBusy}
              aria-disabled={needsIndicator || undefined}
              onClick={() => {
                if (!needsIndicator) action.submit(null);
              }}
            >
              {t("regulatory.portal.save")}
            </Button>
          </div>
        </div>
      </Card>
      <Card title={t("regulatory.portal.address")} headingLevel={2}>
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-surface-muted px-3 py-2 text-[13px] break-all text-ink">
            {address}
          </code>
          <Button
            variant="secondary"
            leadingIcon={<Copy aria-hidden="true" />}
            onClick={() => {
              void navigator.clipboard.writeText(address).then(() => {
                showToast({ message: t("regulatory.portal.copied"), tone: "success" });
              });
            }}
          >
            {t("regulatory.portal.copy")}
          </Button>
          <a
            href={`/portal/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[var(--web-control-md)] items-center gap-2 text-[13px] font-semibold text-action"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            {t("regulatory.portal.open")}
          </a>
        </div>
      </Card>
    </div>
  );
}
