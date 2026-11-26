import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import { useFormatNumber } from "../format/use-formatters";

/** "Resumen de hoy": one number per card, each linking to the records behind it. */
export function HomeKpis({ items }: { items: readonly HubCardItem[] }) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="home-kpis" className="flex flex-col gap-3">
      <h2 id="home-kpis" className="m-0 text-base font-semibold">
        {t("discovery.home.summary")}
      </h2>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-4 p-0">
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <Link
              {...item.link}
              className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-ink no-underline shadow-card transition-colors hover:border-action/40"
            >
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                <item.icon aria-hidden="true" strokeWidth={1.75} className="size-4 text-action" />
                {item.title}
              </span>
              <span className="text-3xl leading-9 font-bold tracking-tight tabular-nums">
                {formatNumber(item.count ?? 0)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
