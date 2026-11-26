import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useApiClient } from "../../api/ApiClientProvider";
import { usePermitSubmit } from "../permits/use-permit-submit";
import type { DeviceStatus, ReleaseDevice } from "./devices-query";

/** The backend takes any non-empty reason; the UI asks for a short real one, as for a void. */
export const DEVICE_REASON_MIN = 10;

const NEXT: Record<string, DeviceStatus> = { active: "inactive", inactive: "active" };

/** Change the status with a written reason, guarded by the revision the user is looking at. */
export function useDeviceStatus(device: ReleaseDevice, onSaved: () => void) {
  const client = useApiClient();
  const submit = usePermitSubmit(onSaved, "releases.devices.conflict");
  const [status, setStatus] = useState<DeviceStatus>(NEXT[device.status] ?? "retired");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const send = (event: SyntheticEvent) => {
    event.preventDefault();
    const cleaned = reason.trim();
    setReasonError(cleaned.length < DEVICE_REASON_MIN);
    if (cleaned.length < DEVICE_REASON_MIN) return;
    submit.run((guard) =>
      client.POST("/api/v1/release-devices/{id}/status/", {
        params: { path: { id: device.id } },
        body: { status, reason: cleaned, expected_revision: device.revision },
        signal: guard.signal,
      }),
    );
  };
  return {
    status,
    reason,
    reasonError,
    failure: submit.failure,
    isBusy: submit.isBusy,
    send,
    setStatus,
    setReason,
  };
}
