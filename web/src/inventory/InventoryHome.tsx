import { MapPin, PackageOpen, QrCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import { HubGrid } from "../components/templates/HubGrid";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import { InlineNotice } from "../ui/InlineNotice";
import { InventoryStepCard } from "./hub/InventoryStepCard";
import { useHubSteps } from "./hub/use-hub-steps";
import { useInventoryHub } from "./hub/use-inventory-hub";

/** Inventory home: the daily flow in order, then the one-time setup. */
export function InventoryHome() {
  const { t } = useTranslation();
  const can = useCan();
  const facts = useInventoryHub();
  const steps = useHubSteps(facts);
  const title = t("inventory.page.home");
  useDocumentTitle(title);
  const setup = (
    [
      can("location.read") && {
        id: "locations",
        icon: MapPin,
        link: { to: "/inventory/locations" },
        title: t("hub.inventory.setup.locations.title"),
        description: t("hub.inventory.setup.locations.text"),
        meta:
          facts.locations === 0
            ? t("hub.inventory.setup.locations.empty")
            : facts.locations !== undefined
              ? t("hub.inventory.setup.locations.count", { count: facts.locations })
              : undefined,
      },
      can("supply_type.read") && {
        id: "supplies",
        icon: PackageOpen,
        link: { to: "/inventory/supplies" },
        title: t("hub.inventory.setup.supplies.title"),
        description: t("hub.inventory.setup.supplies.text"),
        meta:
          facts.supplies === 0
            ? t("hub.inventory.setup.supplies.empty")
            : facts.supplies !== undefined
              ? t("hub.inventory.setup.supplies.count", { count: facts.supplies })
              : undefined,
      },
      can("lot.read") && {
        id: "labels",
        icon: QrCode,
        link: { to: "/inventory/labels" },
        title: t("inventory.labels.card"),
        description: t("inventory.labels.cardHint"),
      },
    ] as (HubCardItem | false)[]
  ).filter((item): item is HubCardItem => item !== false);
  const isSetupMissing = facts.locations === 0 || facts.supplies === 0;
  const primaryId = steps.find((step) => step.pill)?.id ?? steps[0]?.id;
  return (
    <PageFrame>
      <PageHeader title={title} description={t("hub.inventory.description")} />
      {isSetupMissing && <InlineNotice tone="info">{t("hub.inventory.setupMissing")}</InlineNotice>}
      {steps.length > 0 && (
        <section aria-labelledby="inventory-daily" className="flex flex-col gap-4">
          <h2 id="inventory-daily" className="m-0 text-lg leading-7 font-semibold text-ink">
            {t("hub.inventory.daily")}
          </h2>
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {steps.map(({ id, ...step }, index) => (
              <InventoryStepCard
                key={id}
                number={index + 1}
                isPrimary={id === primaryId}
                {...step}
              />
            ))}
          </ol>
        </section>
      )}
      {setup.length > 0 && (
        <section aria-labelledby="inventory-setup" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="inventory-setup" className="m-0 text-lg leading-7 font-semibold text-ink">
              {t("hub.inventory.setup")}
            </h2>
            <p className="m-0 text-sm leading-5 text-ink-2">{t("hub.inventory.setupHint")}</p>
          </div>
          <HubGrid items={setup} label={t("hub.inventory.setup")} />
        </section>
      )}
    </PageFrame>
  );
}
