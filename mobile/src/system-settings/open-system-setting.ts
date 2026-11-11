import { Linking } from "react-native";

/** Android settings screens a banner can send the user to. `app` is this app's permission page. */
export type SettingTarget = "app" | "location" | "storage" | "network";

const ACTIONS: Readonly<Record<Exclude<SettingTarget, "app">, string>> = {
  location: "android.settings.LOCATION_SOURCE_SETTINGS",
  storage: "android.settings.INTERNAL_STORAGE_SETTINGS",
  network: "android.settings.WIRELESS_SETTINGS",
};

/**
 * Opens the settings screen that fixes a warning. The short trip is covered by the background-lock
 * grace, so the PIN is not asked again. If the specific screen is missing, the app page opens.
 */
export async function openSystemSetting(target: SettingTarget): Promise<void> {
  try {
    if (target === "app") await Linking.openSettings();
    else await Linking.sendIntent(ACTIONS[target]);
  } catch {
    await Linking.openSettings().catch(() => undefined);
  }
}
