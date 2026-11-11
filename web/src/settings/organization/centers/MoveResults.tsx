import { useTranslation } from "react-i18next";
import { StatusPill } from "../../../ui/StatusPill";
import { RESULT_KEYS, reasonKeyOf } from "./centers-api";
import type { MoveResult } from "./centers-api";

/** Per-item outcome of a bulk step: what moved, and what failed and why. */
export function MoveResults({ results }: { results: readonly MoveResult[] }) {
  const { t } = useTranslation();
  if (results.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm" aria-live="polite">
      {results.map((row) => (
        <li
          key={row.id ?? row.location_id ?? row.transfer_code}
          className="flex flex-wrap items-center gap-2"
        >
          <span className="font-semibold">{row.code ?? row.location_code ?? ""}</span>
          <StatusPill tone={row.status === "failed" ? "critical" : "success"}>
            {t(RESULT_KEYS[row.status])}
          </StatusPill>
          {row.status === "failed" && (
            <span className="text-ink-2">{t(reasonKeyOf(row.reason))}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
