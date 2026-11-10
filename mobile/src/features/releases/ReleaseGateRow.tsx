import { useT } from "../../i18n/I18nProvider.tsx";
import { GateRow } from "../../ui/GateRow.tsx";
import type { GateState } from "../../ui/GateRow.tsx";
import type { ReleaseGateView } from "./view-model.ts";

const GATE_KEYS = {
  permit: "mobile.release.gatePermit",
  zone: "mobile.release.gateZone",
  lot: "mobile.release.gateLot",
  training: "mobile.release.gateTraining",
  schedule: "mobile.release.gateSchedule",
  gps: "mobile.release.gateGps",
  device: "mobile.release.gateDevice",
  configuration: "mobile.release.gateConfiguration",
} as const;
const CONTACT_KEYS = {
  supervisor: "mobile.release.contactSupervisor",
  admin: "mobile.release.contactAdmin",
  courier: "mobile.release.contactCourier",
} as const;
const STATE = {
  pass: { state: "pass", key: "courier.flow.release.gateOk" },
  fail: { state: "fail", key: "courier.flow.release.gateFail" },
  unavailable: { state: "warn", key: "courier.flow.release.gateUnknown" },
} as const satisfies Record<ReleaseGateView["state"], { state: GateState; key: string }>;

/** One green row per check the app already made; a failed one says why and who can unblock it. */
export function ReleaseGateRow({ gate }: { readonly gate: ReleaseGateView }) {
  const t = useT();
  const view = STATE[gate.state];
  const detail = [gate.detailKey ? t(gate.detailKey) : null, t(CONTACT_KEYS[gate.contact])]
    .filter((line): line is string => line !== null)
    .join(" ");
  return (
    <GateRow
      label={t(GATE_KEYS[gate.name])}
      state={view.state}
      stateLabel={t(view.key)}
      detail={detail}
    />
  );
}
