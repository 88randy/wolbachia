/* eslint-disable max-lines-per-function -- presentational/composition unit; splitting it into one-use fragments would hurt readability. */
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../format/use-format-date-time";
import type { HistoryEntry } from "./discovery-query";
import { historyText } from "./history-text";
import { historyScreen } from "./record-links";

/** One event of the timeline: what happened, when, who did it, why, and what it relates to. */
export function HistoryEntryItem({ entry }: { entry: HistoryEntry }) {
  const { t } = useTranslation();
  const formatDateTime = useFormatDateTime();
  const text = historyText(entry.kind, entry.params);
  const isVoid = entry.kind === "record.void";
  return (
    <li className="relative flex flex-col gap-1 pb-6 pl-8 last:pb-0">
      <span
        aria-hidden="true"
        className="absolute top-1.5 left-0 size-3 rounded-full border-2 border-action bg-surface"
      />
      <span aria-hidden="true" className="absolute top-5 bottom-0 left-[5px] w-0.5 bg-line" />
      <p
        className={
          isVoid
            ? "m-0 text-sm font-semibold text-critical-fg"
            : "m-0 text-sm font-semibold text-ink"
        }
      >
        {t(text.key, text.params)}
      </p>
      <p className="m-0 text-xs text-ink-3">
        <time dateTime={entry.occurred_at}>{formatDateTime(entry.occurred_at)}</time>
        {entry.author && ` · ${t("discovery.history.by", { name: entry.author.username })}`}
      </p>
      {entry.reason && (
        <p className="m-0 text-[13px] text-ink-2">
          {t("discovery.history.reason", { reason: entry.reason })}
        </p>
      )}
      {entry.refs.map((ref) => (
        <Link
          key={`${ref.type}-${ref.code}`}
          {...historyScreen(ref.type, ref.code)}
          className="w-fit text-[13px] font-semibold text-action hover:underline"
        >
          {t("discovery.history.related", {
            type: t(`discovery.typeOne.${ref.type}`),
            code: ref.code,
          })}
        </Link>
      ))}
    </li>
  );
}
