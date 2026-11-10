import { useState } from "react";
import type { SyntheticEvent } from "react";
import { useApiClient } from "../../api/ApiClientProvider";
import type { Permit } from "./permits-query";
import { usePermitSubmit } from "./use-permit-submit";

/** Same minimum as the backend (`normalize_reason`); the server is the authority. */
export const SUSPEND_REASON_MIN = 10;

/**
 * Suspend with a written reason, guarded by the revision the user is looking at. A 409 (someone
 * else changed the permit) refreshes the record and keeps the typed reason; nothing is replayed.
 */
export function useSuspendPermit(permit: Permit, onSuspended: () => void) {
  const client = useApiClient();
  const submit = usePermitSubmit(onSuspended, "permits.suspend.conflict");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const send = (event: SyntheticEvent) => {
    event.preventDefault();
    const cleaned = reason.trim();
    setReasonError(cleaned.length < SUSPEND_REASON_MIN);
    if (cleaned.length < SUSPEND_REASON_MIN) return;
    submit.run((guard) =>
      client.POST("/api/v1/permits/{id}/suspend/", {
        params: { path: { id: permit.id } },
        body: { reason: cleaned, expected_revision: permit.revision },
        signal: guard.signal,
      }),
    );
  };
  return { reason, reasonError, failure: submit.failure, isBusy: submit.isBusy, send, setReason };
}
