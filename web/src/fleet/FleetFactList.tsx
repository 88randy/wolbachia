import type { ReactNode } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../components/templates/DescriptionGrid";
export type FleetFact = readonly [MessageKey, ReactNode];
/** Record facts as a label-above-value grid, the same in every history. */
export function FleetFactList({ facts }: { facts: readonly FleetFact[] }) {
  const { t } = useTranslation();
  return (
    <DescriptionGrid columns={2} items={facts.map(([key, value]) => ({ label: t(key), value }))} />
  );
}
