/* eslint-disable max-lines-per-function -- presentational/composition unit; splitting it into one-use fragments would hurt readability. */
import type { MessageKey } from "@wolbachia/i18n";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { HomeSummary } from "../discovery/discovery-query";
import { ownScreen } from "../discovery/record-links";
import { useFormatDateTime } from "../format/use-format-date-time";
import { StatusPill } from "../ui/StatusPill";
import type { Tone } from "../ui/tone";

type Item = HomeSummary["critical"][number];

const SEVERITY_KEY: Readonly<Record<string, MessageKey>> = {
  critical: "incidents.severity.critical",
  high: "incidents.severity.high",
  medium: "incidents.severity.medium",
  low: "incidents.severity.low",
};

const SEVERITY_TONE: Readonly<Record<string, Tone>> = {
  critical: "critical",
  high: "warning",
  medium: "info",
  low: "neutral",
};

function Row({ item }: { item: Item }) {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const target = ownScreen(item.type, item.code);
  const severityKey = SEVERITY_KEY[item.severity];
  const label = severityKey === undefined ? "" : t(severityKey);
  const content = (
    <>
      <StatusPill tone={SEVERITY_TONE[item.severity] ?? "neutral"}>{label}</StatusPill>
      <span className="min-w-0 flex-1 font-mono text-sm font-semibold">{item.code}</span>
      <span className="text-xs text-ink-2">
        {item.deadline
          ? t("discovery.home.dueBy", { date: formatDateTime(item.deadline) })
          : t("discovery.home.noDeadline")}
      </span>
    </>
  );
  const cls =
    "flex flex-wrap items-center gap-3 rounded-xl px-3 py-2.5 text-ink no-underline hover:bg-surface-muted";
  return (
    <li>
      {target ? (
        <Link {...target} className={cls}>
          {content}
        </Link>
      ) : (
        <div className={cls}>{content}</div>
      )}
    </li>
  );
}

/** "Lo que necesita tu atención": critical items first, then the overdue ones, each opening its record. */
export function HomeAttention({ summary }: { summary: HomeSummary }) {
  const { t } = useTranslation();
  const critical = new Set(summary.critical.map((item) => item.code));
  const items = [
    ...summary.critical,
    ...summary.attention.filter((item) => !critical.has(item.code)),
  ];
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="home-attention"
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 shadow-card"
    >
      <h2 id="home-attention" className="m-0 px-3 text-base font-semibold">
        {t("discovery.home.attention")}
      </h2>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => (
          <Row key={`${item.type}-${item.code}`} item={item} />
        ))}
      </ul>
    </section>
  );
}
