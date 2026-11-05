import { useState } from "react";

import { useServices } from "../app/services-context.ts";
import type { AuthSnapshot } from "./auth-controller.ts";
import { isAllowedPin, PIN_LENGTH } from "./pin-rules.ts";
import type { useAuthAction } from "./use-auth-action.ts";

export function usePinInput(snapshot: AuthSnapshot, action: ReturnType<typeof useAuthAction>) {
  const { auth } = useServices();
  const [pin, setPin] = useState("");
  const setup = usePinConfirmation(action);
  const digit = (value: string) => {
    if (action.isBusy) return;
    const next = pin + value;
    setPin(next);
    if (next.length !== PIN_LENGTH) return;
    if (snapshot.phase === "createPin" && !setup.confirm(next)) {
      setPin("");
      return;
    }
    action.run(() =>
      submitPin(auth, { phase: snapshot.phase, pin: next }, () => {
        setPin("");
      }),
    );
  };
  return {
    pin,
    confirmation: setup.confirmation,
    digit,
    erase: () => {
      if (!action.isBusy) setPin((current) => current.slice(0, -1));
    },
  };
}

function usePinConfirmation(action: ReturnType<typeof useAuthAction>) {
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const confirm = (pin: string): boolean => {
    if (!isAllowedPin(pin)) {
      action.setError({ key: "mobile.unlock.trivialPin" });
      return false;
    }
    if (confirmation === null) {
      action.setError(null);
      setConfirmation(pin);
      return false;
    }
    if (confirmation !== pin) {
      setConfirmation(null);
      action.setError({ key: "mobile.unlock.pinMismatch" });
      return false;
    }
    return true;
  };
  return { confirmation, confirm };
}

async function submitPin(
  auth: ReturnType<typeof useServices>["auth"],
  input: { phase: AuthSnapshot["phase"]; pin: string },
  clear: () => void,
): Promise<void> {
  try {
    if (input.phase === "createPin") await auth.createPin(input.pin);
    else await auth.unlock(input.pin, "pin");
  } finally {
    clear();
  }
}
