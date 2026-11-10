import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import { StatusPill } from "../../ui/StatusPill";
import type { Relocation } from "./relocations-query";
import { relocationFields, relocationStatusKey, snapshotText } from "./relocation-snapshot";
export function RelocationSnapshot({ proposal }: { proposal: Relocation }) {
  const { t, i18n } = useTranslation();
  const format = useFormatDateTime();
  return (
    <>
      <StatusPill tone={proposal.status === "pending" ? "warning" : "neutral"}>
        {t(relocationStatusKey(proposal.status))}
      </StatusPill>
      <dl>
        {relocationFields(proposal, format, i18n.language).map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details>
        <summary>{t("relocations.workspace.capturedRules")}</summary>
        <p>{snapshotText(proposal.evaluated_rules)}</p>
        <p>{snapshotText(proposal.rule_version_ids)}</p>
      </details>
      {proposal.voided_at && (
        <p>
          {t("relocations.workspace.voided")} {proposal.void_reason_code} {proposal.void_reason}
        </p>
      )}
    </>
  );
}
