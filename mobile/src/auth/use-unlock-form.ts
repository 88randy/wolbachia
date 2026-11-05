import { useState } from "react";

import { useServices } from "../app/services-context.ts";
import type { AuthSnapshot } from "./auth-controller.ts";
import { useAuthAction } from "./use-auth-action.ts";
import { useBiometricUnlock } from "./use-biometric-unlock.ts";
import { usePinInput } from "./use-pin-input.ts";

export function useUnlockForm(snapshot: AuthSnapshot) {
  const { auth } = useServices();
  const action = useAuthAction();
  const [password, setPassword] = useState("");
  const pinInput = usePinInput(snapshot, action);
  const biometrics = useBiometricUnlock(action);
  const submitPassword = () => {
    action.run(async () => {
      try {
        await auth.unlock(password, "password");
      } finally {
        setPassword("");
      }
    });
  };
  return { ...pinInput, ...action, ...biometrics, password, setPassword, submitPassword };
}
