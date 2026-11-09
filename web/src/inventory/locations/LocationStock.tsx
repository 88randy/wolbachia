import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { FolderTabs } from "../../ui/FolderTabs";
import { useCan } from "../../session/use-can";
import { LocationInventoryTable } from "./LocationInventoryTable";
function useStockNavigation() {
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const value = search["view"] === "movements" ? "movements" : "stock";
  const center = typeof search["center"] === "string" ? { center: search["center"] } : {};
  const custody =
    typeof search["custody_location"] === "string"
      ? { custody_location: search["custody_location"] }
      : {};
  const onValueChange = (view: string) => {
    void navigate({ to: ".", search: () => ({ view, ...center, ...custody }) });
  };
  return { value, onValueChange };
}
/** URL metadata stays with the actual location; filters select real server ledger pages. */
export function LocationStock({ location }: { location: Schemas["Location"] }) {
  const { t } = useTranslation();
  const navigation = useStockNavigation();
  const allowed = useCan()("lot.read");
  if (!allowed) return null;
  const items = [
    {
      value: "stock",
      label: t("inventory.section.stock"),
      content: <LocationInventoryTable location={location} movements={false} />,
    },
    {
      value: "movements",
      label: t("inventory.section.movements"),
      content: <LocationInventoryTable location={location} movements />,
    },
  ];
  return <FolderTabs label={t("inventory.section.stock")} {...navigation} items={items} />;
}
