import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Me } from "../../session/me";
import { useMe } from "../../session/use-me";
import { can } from "../../session/can";
import { todayIn } from "../../format/time-zone";
import { useOrganizationTimeZone } from "../../format/use-time-zone";
import { lotDirectoryOptions, originOptions } from "./allocation-query";
import type { AllocationScope } from "./allocation-query";
import { useAllocationCommand } from "./use-allocation-command";
import { useReasonFields } from "./use-reason-fields";
import { useWriteOffLookup } from "./use-write-off-lookup";
import type { Found } from "./use-write-off-lookup";
import {
  buildWriteOffDraft,
  isBiological,
  wholeLotQuantity,
  writeOffBlockers,
} from "./write-off-draft";
import type { WriteOffTarget } from "./write-off-draft";

export type WriteOffKind = "lot" | "bag";

function allowedKinds(me: Me): WriteOffKind[] {
  return [
    ...(can(me, "inventory.write_off") ? (["lot"] as const) : []),
    ...(can(me, "bag.dispose") ? (["bag"] as const) : []),
  ];
}

/** Plain typed values of the form; the target derives from them and the resolved record. */
function useInputs(kinds: WriteOffKind[], defaultKind: WriteOffKind) {
  const [kind, setKind] = useState<WriteOffKind>(
    kinds.includes(defaultKind) ? defaultKind : (kinds[0] ?? defaultKind),
  );
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [locationId, setLocationId] = useState("");
  const timeZone = useOrganizationTimeZone();
  const [date, setDate] = useState(todayIn(timeZone));
  const [rpbiUploadId, setRpbiUploadId] = useState("");
  return {
    ...{ kind, code, quantity, locationId, date, rpbiUploadId },
    ...{ setKind, setCode, setQuantity, setLocationId, setDate, setRpbiUploadId },
  };
}
type Inputs = ReturnType<typeof useInputs>;

function targetOf(found: Found | null, inputs: Inputs): WriteOffTarget | null {
  if (found?.kind === "bag") return { kind: "bag", bag: found.bag };
  if (found?.kind !== "lot") return null;
  const locationId = inputs.locationId || (found.lot.initial_location_id ?? "");
  return { kind: "lot", lot: found.lot, quantity: inputs.quantity, locationId };
}

/** Warehouse (W17) and lab (W39) share this one form; only the default target kind differs. */
export function useWriteOffForm(scope: AllocationScope, route: string, defaultKind: WriteOffKind) {
  const me = useMe();
  const kinds = allowedKinds(me).filter((kind) => kind === defaultKind);
  const inputs = useInputs(kinds, defaultKind);
  const lookup = useWriteOffLookup(scope);
  const reason = useReasonFields("writeOff");
  const command = useAllocationCommand(scope);
  const locations = useQuery(originOptions(scope, route)).data ?? [];
  const lots = useQuery(lotDirectoryOptions(scope, route)).data ?? [];
  const target = targetOf(lookup.found, inputs);
  const { reasonCode, reason: note } = reason;
  const fields = { target, ...inputs, reasonCode, reason: note, ownerId: me.user.id };
  const blockers = writeOffBlockers(fields, reason);
  const changeKind = (next: WriteOffKind) => {
    inputs.setKind(next);
    inputs.setCode("");
    inputs.setRpbiUploadId("");
    lookup.clear();
  };
  /** Scanned, typed or picked code: find the record and fill the rest (all of a lot by default). */
  const chooseCode = async (code: string) => {
    inputs.setCode(code);
    inputs.setQuantity("");
    inputs.setLocationId("");
    inputs.setRpbiUploadId("");
    const found = await lookup.find(inputs.kind, code);
    if (found?.kind === "lot") inputs.setQuantity(wholeLotQuantity(found.lot));
  };
  const startOver = () => {
    inputs.setCode("");
    inputs.setQuantity("");
    inputs.setLocationId("");
    lookup.clear();
  };
  const submit = () => {
    const draft = blockers.length === 0 ? buildWriteOffDraft(fields) : null;
    if (draft) void command.send(draft);
  };
  const locationId = target?.kind === "lot" ? target.locationId : "";
  const isBio = isBiological(target);
  return {
    ...{ kinds, lookup, reason, command, blockers, target, changeKind, submit, locations, lots },
    ...{ chooseCode, startOver },
    ...{ ...inputs, locationId, isBiological: isBio },
  };
}
export type WriteOffForm = ReturnType<typeof useWriteOffForm>;
