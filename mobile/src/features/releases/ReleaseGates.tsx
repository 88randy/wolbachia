import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { ReleaseGateRow } from "./ReleaseGateRow.tsx";
import { hasBlockedReleaseGate, RELEASE_GATE_NAMES } from "./view-model.ts";
import type { ReleaseGateView } from "./view-model.ts";

export function ReleaseGates({ gates }: { readonly gates: readonly ReleaseGateView[] }) {
  const t = useT();
  const isBlocked = hasBlockedReleaseGate(gates);
  return (
    <Card isCritical={isBlocked}>
      <AppText variant="button" accessibilityRole="header">
        {t("mobile.release.prerequisites")}
      </AppText>
      {RELEASE_GATE_NAMES.map((name) => (
        <ReleaseGateRow
          key={name}
          gate={
            gates.find((gate) => gate.name === name) ?? {
              name,
              state: "unavailable",
              contact: "supervisor",
            }
          }
        />
      ))}
      <AppText variant="caption">
        {t(isBlocked ? "mobile.release.noBypass" : "mobile.release.cachedOnly")}
      </AppText>
    </Card>
  );
}
