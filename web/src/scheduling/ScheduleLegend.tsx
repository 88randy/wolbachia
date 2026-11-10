import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
import { ACTION_ICON, ACTION_ORDER, RISK_TONE } from "./action-meta";
import type { RiskLevel } from "./action-meta";

const RISKS: readonly RiskLevel[] = ["high", "medium", "low"];

/** What each icon and color on the day list means, always visible below it. */
export function ScheduleLegend() {
  const { t } = useTranslation();
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl bg-surface-muted p-4 text-[13px] text-ink-2">
      <p className="m-0 font-semibold text-ink">{t("scheduling.legend.title")}</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {ACTION_ORDER.map((action) => {
          const Icon = ACTION_ICON[action];
          return (
            <li key={action} className="flex items-start gap-2">
              <Icon aria-hidden="true" className="mt-0.5 size-4 flex-none text-action-strong" />
              {t(`scheduling.legend.${action}`)}
            </li>
          );
        })}
      </ul>
      <p className="m-0 flex flex-wrap items-center gap-2">
        <span className="font-semibold text-ink">{t("scheduling.legend.risk")}</span>
        {RISKS.map((risk) => (
          <StatusPill key={risk} tone={RISK_TONE[risk]}>
            {t(`scheduling.risk.${risk}`)}
          </StatusPill>
        ))}
      </p>
    </div>
  );
}
