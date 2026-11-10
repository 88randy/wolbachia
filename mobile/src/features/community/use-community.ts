import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createScopedApiClient } from "../../api/create-scoped-api-client.ts";
import { useServices } from "../../app/services-context.ts";
import { loadActivityTypes, loadZones, sendActivity } from "./community-api.ts";
import type { ActivityType, ActivityZone } from "./community-api.ts";

type LoadState = "loading" | "ready" | "failed";
type SendState = "idle" | "sending" | "sent" | "failed";

/**
 * P25 draft and its two server reads. Registering an activity needs a connection (the backend
 * endpoint is HTTP); the draft stays on screen and the same command id is reused on retry.
 */
export function useCommunity() {
  const { tokens } = useServices();
  const client = useMemo(() => createScopedApiClient({ tokens }), [tokens]);
  const [types, setTypes] = useState<readonly ActivityType[]>([]);
  const [zones, setZones] = useState<readonly ActivityZone[]>([]);
  const [load, setLoad] = useState<LoadState>("loading");
  const [send, setSend] = useState<SendState>("idle");
  const [commandId, setCommandId] = useState(() => randomUUID());
  const [typeId, setTypeId] = useState<string | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [attendance, setAttendance] = useState(0);
  const [agreements, setAgreements] = useState("");
  const [otherText, setOtherText] = useState("");

  const reload = useCallback(async () => {
    try {
      const [loadedTypes, loadedZones] = await Promise.all([
        loadActivityTypes(client),
        loadZones(client),
      ]);
      setTypes(loadedTypes);
      setZones(loadedZones);
      setLoad("ready");
    } catch {
      setLoad((previous) => (previous === "ready" ? previous : "failed"));
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedType = types.find((type) => type.id === typeId) ?? null;
  const needsOther = selectedType?.is_other === true;
  const canSend =
    send !== "sending" &&
    selectedType !== null &&
    zoneId !== null &&
    attendance > 0 &&
    (!needsOther || otherText.trim().length > 0);

  const submit = async () => {
    if (!canSend || typeId === null || zoneId === null) return;
    setSend("sending");
    try {
      await sendActivity(client, {
        commandId,
        typeId,
        zoneId,
        attendance,
        agreements: agreements.trim(),
        otherText: needsOther ? otherText.trim() : "",
      });
      setSend("sent");
    } catch {
      setSend("failed");
    }
  };

  const startAnother = () => {
    setCommandId(randomUUID());
    setTypeId(null);
    setZoneId(null);
    setAttendance(0);
    setAgreements("");
    setOtherText("");
    setSend("idle");
  };

  return {
    types,
    zones,
    load,
    send,
    typeId,
    zoneId,
    attendance,
    agreements,
    otherText,
    needsOther,
    canSend,
    selectType: setTypeId,
    selectZone: setZoneId,
    setAttendance,
    setAgreements,
    setOtherText,
    reload,
    submit,
    startAnother,
  };
}

export type CommunityModel = ReturnType<typeof useCommunity>;
