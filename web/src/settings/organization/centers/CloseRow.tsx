import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCan } from "../../../session/use-can";
import { StatusPill } from "../../../ui/StatusPill";
import { permissionLabel } from "../permission-labels";
import { ROW_KEYS } from "./centers-api";
import type { ReadinessRow } from "./centers-api";

function RowStatus({ row }: { row: ReadinessRow }) {
  const { t } = useTranslation();
  if (!row.is_blocking) return <StatusPill tone="info">{t("centersAdmin.close.info")}</StatusPill>;
  return row.count === 0 ? (
    <StatusPill tone="success">{t("centersAdmin.close.ready")}</StatusPill>
  ) : (
    <StatusPill tone="warning">{t("centersAdmin.close.pending")}</StatusPill>
  );
}

function WhoCan({ permission }: { permission: string }) {
  const { t, i18n } = useTranslation();
  const label = permissionLabel(permission, t, (key) => i18n.exists(key));
  return (
    <p className="m-0 text-sm text-ink-2">
      {t("centersAdmin.close.whoCan", { permission: label })}
    </p>
  );
}

/** One checklist row: status, a plain one-line explanation, its count and ONE action. */
export function CloseRow({ row, children }: { row: ReadinessRow; children: ReactNode }) {
  const { t } = useTranslation();
  const can = useCan();
  const keys = ROW_KEYS[row.key];
  const isDone = row.is_blocking && row.count === 0;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <RowStatus row={row} />
        <h3 className="m-0 text-sm font-semibold">{t(keys.title)}</h3>
        {row.count > 0 && (
          <span className="text-sm text-ink-2 tabular-nums">
            {t("centersAdmin.close.count", { count: row.count })}
          </span>
        )}
      </div>
      <p className="m-0 text-sm text-ink-2">{t(keys.help)}</p>
      {!isDone &&
        row.count > 0 &&
        (can(row.permission) ? children : <WhoCan permission={row.permission} />)}
    </li>
  );
}
