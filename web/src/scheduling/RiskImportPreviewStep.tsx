import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { StatusPill } from "../ui/StatusPill";
import type { RiskImport } from "./use-risk-import";

const TONE = { high: "critical", medium: "warning", low: "neutral" } as const;
const KNOWN_ERRORS = [
  "invalid_columns",
  "invalid_row",
  "unsafe_cell",
  "invalid_block_code",
  "invalid_category",
  "invalid_protocol",
  "duplicate_block",
  "block_inaccessible",
  "invalid_utf8",
  "invalid_csv",
  "empty_import",
  "file_too_large",
  "too_many_rows",
] as const;

/** What would change, row by row, before anything is applied. Rows with problems block applying. */
export function RiskImportPreviewStep({ flow }: { flow: RiskImport }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      {flow.errors.length > 0 && (
        <InlineNotice tone="critical">
          <p className="font-semibold">
            {t("scheduling.import.errorsTitle", { count: flow.errors.length })}
          </p>
          <ul className="mt-1 mb-0 pl-5">
            {flow.errors.slice(0, 20).map((error, index) => (
              <li key={`${String(error.row ?? 0)}-${error.code}-${String(index)}`}>
                {error.row ? t("scheduling.import.errorRow", { row: error.row }) : ""}
                {error.block_code ? ` ${error.block_code}: ` : " "}
                {t(
                  `scheduling.import.error.${(KNOWN_ERRORS as readonly string[]).includes(error.code) ? error.code : "unknown"}` as MessageKey,
                )}
              </li>
            ))}
          </ul>
        </InlineNotice>
      )}
      {flow.rows.length > 0 && (
        <>
          <p className="m-0 text-sm text-ink-2">
            {t("scheduling.import.summary", { count: flow.rows.length })}
          </p>
          <div className="max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t("scheduling.import.step3")}</caption>
              <thead className="sticky top-0 bg-surface-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-ink-2">
                    {t("scheduling.risk.block")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-ink-2">
                    {t("scheduling.risk.category")}
                  </th>
                  <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-ink-2">
                    {t("scheduling.risk.protocol")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {flow.rows.map((row) => (
                  <tr key={row.block_code} className="border-t border-line">
                    <td className="px-3 py-2 font-medium">{row.block_code}</td>
                    <td className="px-3 py-2">
                      <StatusPill tone={TONE[row.category]}>
                        {t(`scheduling.risk.${row.category}`)}
                      </StatusPill>
                    </td>
                    <td className="px-3 py-2 text-ink-2">{row.protocol || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
