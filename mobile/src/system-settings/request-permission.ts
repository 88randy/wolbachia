import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { openSystemSetting } from "./open-system-setting.ts";

interface PermissionResult {
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}

/** Ask in place; when the system will not ask again, open the app page so the user can allow it. */
async function askOrOpenSettings(ask: () => Promise<PermissionResult>): Promise<boolean> {
  try {
    const result = await ask();
    if (!result.granted && !result.canAskAgain) await openSystemSetting("app");
    return result.granted;
  } catch {
    await openSystemSetting("app");
    return false;
  }
}

export function requestLocationPermission(): Promise<boolean> {
  return askOrOpenSettings(() => Location.requestForegroundPermissionsAsync());
}

export function requestCameraPermission(): Promise<boolean> {
  return askOrOpenSettings(() => ImagePicker.requestCameraPermissionsAsync());
}
