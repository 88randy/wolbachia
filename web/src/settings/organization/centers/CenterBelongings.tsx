import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../../../components/templates/DescriptionGrid";
import { DetailSection } from "../../../components/templates/DetailSection";
import { useFormatNumber } from "../../../format/use-formatters";
import type { CenterRow } from "./centers-api";

type CountField = "quadrant_count" | "motorcycle_count" | "warehouse_count";

const COUNTS: readonly { labelKey: MessageKey; field: CountField; to: LinkProps["to"] }[] = [
  { labelKey: "centersAdmin.col.quadrants", field: "quadrant_count", to: "/operations/quadrants" },
  { labelKey: "centersAdmin.col.motorcycles", field: "motorcycle_count", to: "/fleet/motorcycles" },
  { labelKey: "centersAdmin.col.warehouses", field: "warehouse_count", to: "/inventory/locations" },
];

function CountLink({ value, link }: { value: string; link: LinkProps }) {
  return (
    <Link
      {...link}
      className="font-semibold tabular-nums text-action underline-offset-2 hover:underline"
    >
      {value}
    </Link>
  );
}

/** Counts of what the center holds; each one opens the list filtered by this center. */
export function CenterBelongings({ center }: { center: CenterRow }) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const counts = COUNTS.map((count) => ({
    label: t(count.labelKey),
    value: (
      <CountLink
        value={formatNumber(center[count.field] ?? 0)}
        link={{ to: count.to, search: { center: center.id } }}
      />
    ),
  }));
  const people = {
    label: t("centersAdmin.detail.people"),
    value: (
      <CountLink value={t("centersAdmin.detail.peopleLink")} link={{ to: "/settings/users" }} />
    ),
  };
  return (
    <DetailSection title={t("centersAdmin.detail.belongs")}>
      <DescriptionGrid columns={3} items={[...counts, people]} />
    </DetailSection>
  );
}
