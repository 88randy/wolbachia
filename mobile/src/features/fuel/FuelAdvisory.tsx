import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { FuelAdvisory as Advisory } from "./types.ts";

const ADVISORY_KEYS: Readonly<Record<Advisory["kind"], MessageKey>> = {
  insufficient: "mobile.fuel.insufficient",
  unconfigured: "mobile.fuel.unconfigured",
  decreased: "mobile.fuel.decreased",
  ok: "mobile.fuel.efficiencyOk",
  review: "mobile.fuel.efficiencyReview",
};
export function FuelAdvisory({ advisory }: { readonly advisory: Advisory }) {
  const t = useT();
  const isWarning = advisory.kind === "decreased" || advisory.kind === "review";
  return (
    <InfoNotice
      tone={isWarning ? "warning" : advisory.kind === "ok" ? "success" : "info"}
      message={t(ADVISORY_KEYS[advisory.kind])}
    />
  );
}
