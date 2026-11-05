import { useNavigate, useSearch } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
export const FLEET_TABS = ["summary", "services", "responsibility", "fuel", "incidents"] as const;
export type FleetTab = (typeof FLEET_TABS)[number];
export const TAB_KEYS: Record<FleetTab, MessageKey> = {
  summary: "fleet.tab.summary",
  services: "fleet.tab.services",
  responsibility: "fleet.tab.responsibility",
  fuel: "fleet.tab.fuel",
  incidents: "fleet.tab.incidents",
};
function isTab(value: unknown): value is FleetTab {
  return FLEET_TABS.some((tab) => tab === value);
}
/** Tabs patch only their own flat parameter; unavailable history never clears the list view. */
export function useFleetTabs() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const raw = search["tab"];
  const tab = isTab(raw) ? raw : "summary";
  const listSearch: Record<string, string> = Object.fromEntries(
    Object.entries(search).filter(
      (entry): entry is [string, string] => entry[0] !== "tab" && entry[1] !== undefined,
    ),
  );
  const dropUnknown = () => {
    void navigate({ to: ".", search: listSearch });
  };
  return {
    tab,
    search,
    listSearch,
    ignored: raw !== undefined && !isTab(raw) ? ["tab"] : [],
    dropUnknown,
  };
}
