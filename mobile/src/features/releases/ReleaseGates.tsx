import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import { ReleaseGateRow } from "./ReleaseGateRow.tsx";
import { hasBlockedReleaseGate, RELEASE_GATE_NAMES } from "./view-model.ts";
import type { ReleaseGateView } from "./view-model.ts";

export function ReleaseGates({ gates }: { readonly gates: readonly ReleaseGateView[] }) {
  const t = useT();
  const isBlocked = hasBlockedReleaseGate(gates);
  return (
    <>
      {isBlocked ? (
        <InfoNotice
          tone="danger"
          title={t("courier.flow.release.blockedTitle")}
          message={t("courier.flow.release.blockedBody")}
        />
      ) : null}
      <SectionTitle title={t("courier.flow.release.gatesTitle")} />
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
    </>
  );
}
