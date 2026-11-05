import { useEffect, useState } from "react";

import { useServices } from "../app/services-context.ts";
import { useT } from "../i18n/I18nProvider.tsx";
import { authenticateBiometric, hasStrongBiometrics } from "./biometrics.ts";
import type { useAuthAction } from "./use-auth-action.ts";

export function useBiometricUnlock(action: ReturnType<typeof useAuthAction>) {
  const { auth } = useServices();
  const t = useT();
  const [hasBiometrics, setHasBiometrics] = useState(false);
  useEffect(() => {
    void hasStrongBiometrics()
      .then(setHasBiometrics)
      .catch(() => {
        setHasBiometrics(false);
      });
  }, []);
  const biometric = () => {
    action.run(async () => {
      const gate = auth.biometricGate();
      const isAccepted = await authenticateBiometric(
        t("mobile.unlock.biometricPrompt"),
        t("mobile.unlock.cancel"),
      );
      if (isAccepted) auth.unlockBiometric(gate);
    });
  };
  return { biometric, canUseBiometrics: hasBiometrics && auth.canUseBiometrics() };
}
