import { useState } from "react";
import { useServices } from "../../app/services-context.ts";
import { LockedCallAction } from "./LockedCallAction.tsx";
import type { DialOutcome } from "./domain.ts";
/** The lock surface can open a cached work-contact dialer, without reading or unlocking captures. */
export function LockedEmergencyCall() {
  const { incidents } = useServices();
  const [outcome, setOutcome] = useState<DialOutcome | null>(null);
  const call = () => {
    void incidents.call().then(setOutcome, () => {
      setOutcome("unavailable");
    });
  };
  return <LockedCallAction outcome={outcome} call={call} />;
}
