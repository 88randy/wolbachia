import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { IgnoredNotice } from "../data-table/IgnoredNotice";
import { FLEET_TABS, TAB_KEYS, useFleetTabs } from "./use-fleet-tabs";
import styles from "./fleet.module.css";
export function FleetTabs({ code }: { code: string }) {
  const { t } = useTranslation();
  const tabs = useFleetTabs();
  return (
    <>
      <IgnoredNotice names={tabs.ignored} onDismiss={tabs.dropUnknown} />
      <nav className={styles.tabs} aria-label={t("fleet.tab.navigation")}>
        {FLEET_TABS.map((tab) => (
          <Link
            key={tab}
            to="/fleet/motorcycles/$code"
            params={{ code }}
            search={{ ...tabs.search, tab }}
            className={styles.tab}
            aria-current={tabs.tab === tab ? "page" : undefined}
          >
            {t(TAB_KEYS[tab])}
          </Link>
        ))}
      </nav>
    </>
  );
}
