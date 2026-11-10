import { Link } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
import type { SearchGroup } from "./discovery-query";
import { historyScreen, openRecord } from "./record-links";

type Hit = SearchGroup["hits"][number];

/** One record found: its code opens it; the history is one click away. Voided ones say so. */
export function SearchHitRow({ hit }: { hit: Hit }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line px-1 py-2 first:border-t-0">
      <Link
        {...openRecord(hit.type, hit.code)}
        className={
          hit.is_voided
            ? "min-w-0 flex-1 font-mono text-sm font-semibold text-ink-3 line-through"
            : "min-w-0 flex-1 font-mono text-sm font-semibold text-action hover:underline"
        }
      >
        {hit.code}
      </Link>
      {hit.is_voided && <StatusPill tone="neutral">{t("discovery.search.voided")}</StatusPill>}
      <Link
        {...historyScreen(hit.type, hit.code)}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-muted hover:text-action"
      >
        <History aria-hidden="true" strokeWidth={1.75} className="size-4" />
        {t("discovery.search.history")}
      </Link>
    </li>
  );
}
