import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { IgnoredNotice } from "../data-table/IgnoredNotice";
import { cn } from "@/lib/utils";
import { FLEET_TABS, TAB_KEYS, useFleetTabs } from "./use-fleet-tabs";

const TAB_CLASS =
  "inline-flex min-h-10 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-ink-2 hover:text-ink";
const ACTIVE_CLASS = "border-action text-action hover:text-action";

/** Underline tabs of the motorcycle record; the active tab lives in the address. */
export function FleetTabs({ code }: { code: string }) {
  const { t } = useTranslation();
  const tabs = useFleetTabs();
  return (
    <>
      <IgnoredNotice names={tabs.ignored} onDismiss={tabs.dropUnknown} />
      <nav
        className="flex flex-wrap gap-1 border-b border-line"
        aria-label={t("fleet.tab.navigation")}
      >
        {FLEET_TABS.map((tab) => (
          <Link
            key={tab}
            to="/fleet/motorcycles/$code"
            params={{ code }}
            search={{ ...tabs.search, tab }}
            className={cn(TAB_CLASS, tabs.tab === tab && ACTIVE_CLASS)}
            aria-current={tabs.tab === tab ? "page" : undefined}
          >
            {t(TAB_KEYS[tab])}
          </Link>
        ))}
      </nav>
    </>
  );
}
