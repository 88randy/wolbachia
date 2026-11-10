import type { ReactNode } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { DescriptionGrid } from "../components/templates/DescriptionGrid";
export type FleetFact = readonly [MessageKey, ReactNode];
/** Actual record facts, with the same grid and domain labels in every history. */
export function FleetFactList({ facts }: { facts: readonly FleetFact[] }) {
  const { t } = useTranslation();
  return <DescriptionGrid items={facts.map(([key, value]) => ({ label: t(key), value }))} />;
}
