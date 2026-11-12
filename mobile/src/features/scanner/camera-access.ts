export interface CameraPermission {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}
/** `blocked` means the system will not ask again: only the app settings page can fix it. */
export type CameraAccess = "granted" | "denied" | "blocked";

/** Asks for the camera when it is not granted yet; never stays silent, always one of three answers. */
export async function ensureCameraAccess(
  current: CameraPermission | null,
  request: () => Promise<CameraPermission>,
): Promise<CameraAccess> {
  if (current?.granted) return "granted";
  const result = await request();
  if (result.granted) return "granted";
  return result.canAskAgain ? "denied" : "blocked";
}
