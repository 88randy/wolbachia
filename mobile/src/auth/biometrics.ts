import * as LocalAuthentication from "expo-local-authentication";

/** Class 3 biometrics only. Device PIN/password fallback would bypass our attempt policy. */
export async function hasStrongBiometrics(): Promise<boolean> {
  return (
    (await LocalAuthentication.hasHardwareAsync()) &&
    (await LocalAuthentication.isEnrolledAsync()) &&
    (await LocalAuthentication.getEnrolledLevelAsync()) ===
      LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG
  );
}

export async function authenticateBiometric(
  promptMessage: string,
  cancelLabel: string,
): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel,
    biometricsSecurityLevel: "strong",
    disableDeviceFallback: true,
  });
  return result.success;
}
